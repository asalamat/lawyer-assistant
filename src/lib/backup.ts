import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "fs";
import path from "path";
import { create, extract } from "tar";
import { recordAuditEvent } from "./auditLog";
import { pruneCloudBackups, uploadBackupToCloud } from "./cloudBackup";
import db from "./db";
import { getCloudBackupConfig, recordCloudBackupResult } from "./settings";

const PROJECT_ROOT = process.cwd();
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const BACKUPS_DIR = path.join(PROJECT_ROOT, "backups");
const MAX_BACKUPS = 10;

function ensureBackupsDir(): void {
  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export interface BackupInfo {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export async function listBackups(): Promise<BackupInfo[]> {
  ensureBackupsDir();
  return readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith(".tar.gz"))
    .map((fileName) => {
      const stat = statSync(path.join(BACKUPS_DIR, fileName));
      return { fileName, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function pruneOldBackups(keep = MAX_BACKUPS): void {
  const files = readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith(".tar.gz"))
    .map((f) => ({ f, birthtime: statSync(path.join(BACKUPS_DIR, f)).birthtime.getTime() }))
    .sort((a, b) => b.birthtime - a.birthtime);
  for (const { f } of files.slice(keep)) {
    rmSync(path.join(BACKUPS_DIR, f), { force: true });
  }
}

// Snapshots data/ into a single .tar.gz under backups/. The SQLite file is
// handled specially — VACUUM INTO produces a consistent single-file
// snapshot regardless of WAL state, safer than tarring app.db directly
// while it could be mid-write. Everything else in data/ is copied as-is.
export async function createBackup(): Promise<BackupInfo> {
  ensureBackupsDir();
  const slug = timestampSlug();
  const fileName = `backup-${slug}.tar.gz`;
  const archivePath = path.join(BACKUPS_DIR, fileName);
  const stagingDir = path.join(BACKUPS_DIR, `.staging-${slug}`);
  const stagingDataDir = path.join(stagingDir, "data");

  try {
    mkdirSync(stagingDataDir, { recursive: true });
    db.exec(`VACUUM INTO '${path.join(stagingDataDir, "app.db")}'`);

    for (const entry of readdirSync(DATA_DIR)) {
      if (entry.startsWith("app.db")) continue;
      cpSync(path.join(DATA_DIR, entry), path.join(stagingDataDir, entry), { recursive: true });
    }

    await create({ gzip: true, file: archivePath, cwd: stagingDir }, ["data"]);
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }

  pruneOldBackups();

  const stat = statSync(archivePath);
  return { fileName, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() };
}

function assertSafeFileName(fileName: string): void {
  if (
    !fileName.endsWith(".tar.gz") ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("..")
  ) {
    throw new Error("Invalid backup filename");
  }
}

export function getBackupPath(fileName: string): string {
  assertSafeFileName(fileName);
  const fullPath = path.join(BACKUPS_DIR, fileName);
  if (!existsSync(fullPath)) throw new Error("Backup not found");
  return fullPath;
}

export function deleteBackup(fileName: string): void {
  const fullPath = getBackupPath(fileName);
  rmSync(fullPath, { force: true });
}

// Shared by both unattended paths that create a backup without a real user
// action driving it: the external cron-secret endpoint and the in-process
// hourly scheduler (backupScheduler.ts). Local backup always happens; cloud
// upload only runs if cloud backup has actually been configured, and a
// cloud failure never throws back to the caller — a hung/misconfigured
// cloud target must not stop the local backup from being recorded as a
// success, since the local file is the part that actually protects the data.
export async function runScheduledBackup(
  trigger: "cron" | "interval" | "change",
): Promise<{ backup: BackupInfo; cloud: { attempted: boolean; ok: boolean; error?: string } }> {
  const backup = await createBackup();
  const triggerLabel: Record<typeof trigger, string> = {
    interval: `Automatic scheduled backup created: ${backup.fileName}`,
    change: `Automatic backup created after recent activity: ${backup.fileName}`,
    cron: `Scheduled backup created via external cron: ${backup.fileName}`,
  };
  await recordAuditEvent("backup_created", null, triggerLabel[trigger]);

  const cloudConfig = await getCloudBackupConfig();
  if (!cloudConfig) {
    return { backup, cloud: { attempted: false, ok: true } };
  }

  try {
    await uploadBackupToCloud(cloudConfig, getBackupPath(backup.fileName), backup.fileName);
    await pruneCloudBackups(cloudConfig, MAX_BACKUPS).catch(() => {
      // Pruning failure shouldn't mask a successful upload — old cloud
      // backups just pile up until the next successful prune instead.
    });
    await recordCloudBackupResult("ok", { fileName: backup.fileName });
    await recordAuditEvent("cloud_backup_uploaded", null, `Uploaded ${backup.fileName} to cloud storage`);
    return { backup, cloud: { attempted: true, ok: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud upload failed";
    await recordCloudBackupResult("error", { error: message });
    await recordAuditEvent("cloud_backup_failed", null, `Cloud backup upload failed: ${message}`);
    return { backup, cloud: { attempted: true, ok: false, error: message } };
  }
}

// Moves the CURRENT data/ directory aside (never deletes it) and replaces
// it with the archive's contents. The running process already has app.db
// open and the encryption master key cached — neither picks up a
// filesystem swap underneath it safely, so this requires an app restart
// immediately after to take effect. Callers must surface that clearly.
export async function restoreBackup(archivePath: string): Promise<{ movedAsideTo: string }> {
  const slug = timestampSlug();
  const extractDir = path.join(BACKUPS_DIR, `.restore-${slug}`);
  mkdirSync(extractDir, { recursive: true });

  try {
    await extract({ file: archivePath, cwd: extractDir });
    const extractedDataDir = path.join(extractDir, "data");
    if (!existsSync(extractedDataDir)) {
      throw new Error("This archive doesn't look like a valid backup (no data/ folder inside it).");
    }

    const movedAsideTo = path.join(PROJECT_ROOT, `data.before-restore-${slug}`);
    renameSync(DATA_DIR, movedAsideTo);
    renameSync(extractedDataDir, DATA_DIR);
    return { movedAsideTo };
  } finally {
    rmSync(extractDir, { recursive: true, force: true });
  }
}
