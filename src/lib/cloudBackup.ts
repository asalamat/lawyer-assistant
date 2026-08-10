import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  pruneGoogleDriveBackups,
  pruneOneDriveBackups,
  testGoogleDriveConnection,
  testOneDriveConnection,
  uploadToGoogleDrive,
  uploadToOneDrive,
} from "./cloudDriveBackup";
import type { CloudBackupConfig, S3BackupConfig } from "./settings";

// S3-compatible is deliberately generic, not AWS-specific — a custom
// endpoint + forcePathStyle is all that's needed to point this at
// Cloudflare R2, Backblaze B2, Wasabi, DigitalOcean Spaces, or a
// self-hosted MinIO instead of real AWS S3. Google Drive and OneDrive are
// handled by cloudDriveBackup.ts via OAuth instead (see that file) — this
// module just dispatches to whichever provider is actually configured.
function buildS3Client(config: S3BackupConfig): S3Client {
  return new S3Client({
    region: config.region || "us-east-1",
    endpoint: config.endpoint || undefined,
    forcePathStyle: Boolean(config.forcePathStyle),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function objectKey(config: S3BackupConfig, fileName: string): string {
  const prefix = config.prefix ? config.prefix.replace(/\/+$/, "") + "/" : "";
  return `${prefix}${fileName}`;
}

async function uploadToS3(config: S3BackupConfig, filePath: string, fileName: string): Promise<void> {
  const client = buildS3Client(config);
  const body = await readFile(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey(config, fileName),
      Body: body,
      ContentType: "application/gzip",
    }),
  );
}

// Round-trips a tiny throwaway object rather than just HeadBucket —
// HeadBucket only proves the bucket exists and is readable, not that these
// credentials can actually write to it, which is the one thing that
// matters for backups.
async function testS3Connection(config: S3BackupConfig): Promise<void> {
  const client = buildS3Client(config);
  const key = objectKey(config, `.lawyer-assistant-connection-test-${randomBytes(6).toString("hex")}.txt`);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: Buffer.from("lawyer-assistant connection test — safe to ignore/delete"),
      ContentType: "text/plain",
    }),
  );
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

// Mirrors the local pruneOldBackups() in backup.ts — same MAX_BACKUPS
// ceiling, applied independently since cloud storage isn't guaranteed to
// hold the same set of files as the local backups/ directory (e.g. after a
// restore, or if cloud upload has been failing intermittently).
async function pruneS3Backups(config: S3BackupConfig, keep: number): Promise<void> {
  const client = buildS3Client(config);
  const prefix = config.prefix ? config.prefix.replace(/\/+$/, "") + "/" : "";
  const response = await client.send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix }));
  const backups = (response.Contents ?? [])
    .filter((obj) => obj.Key?.endsWith(".tar.gz"))
    .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0));
  for (const obj of backups.slice(keep)) {
    if (obj.Key) await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: obj.Key }));
  }
}

export async function uploadBackupToCloud(config: CloudBackupConfig, filePath: string, fileName: string): Promise<void> {
  if (config.provider === "s3") return uploadToS3(config, filePath, fileName);
  if (config.provider === "google-drive") return uploadToGoogleDrive(config, filePath, fileName);
  return uploadToOneDrive(config, filePath, fileName);
}

export async function testCloudBackupConnection(config: CloudBackupConfig): Promise<void> {
  if (config.provider === "s3") return testS3Connection(config);
  if (config.provider === "google-drive") return testGoogleDriveConnection(config);
  return testOneDriveConnection(config);
}

export async function pruneCloudBackups(config: CloudBackupConfig, keep = 10): Promise<void> {
  if (config.provider === "s3") return pruneS3Backups(config, keep);
  if (config.provider === "google-drive") return pruneGoogleDriveBackups(config, keep);
  return pruneOneDriveBackups(config, keep);
}
