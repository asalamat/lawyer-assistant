import { NextResponse } from "next/server";
import { getCloudBackupStatus, setS3BackupConfig } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getCloudBackupStatus());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { endpoint, region, bucket, accessKeyId, secretAccessKey, prefix, forcePathStyle } = body ?? {};

  if (typeof region !== "string" || !region.trim()) {
    return NextResponse.json({ error: "region is required" }, { status: 400 });
  }
  if (typeof bucket !== "string" || !bucket.trim()) {
    return NextResponse.json({ error: "bucket is required" }, { status: 400 });
  }
  if (typeof accessKeyId !== "string" || !accessKeyId.trim()) {
    return NextResponse.json({ error: "accessKeyId is required" }, { status: 400 });
  }
  if (typeof secretAccessKey !== "string" || !secretAccessKey) {
    return NextResponse.json({ error: "secretAccessKey is required" }, { status: 400 });
  }

  await setS3BackupConfig({
    endpoint: typeof endpoint === "string" ? endpoint.trim() : undefined,
    region: region.trim(),
    bucket: bucket.trim(),
    accessKeyId: accessKeyId.trim(),
    secretAccessKey,
    prefix: typeof prefix === "string" ? prefix.trim() : undefined,
    forcePathStyle: Boolean(forcePathStyle),
  });

  return NextResponse.json(await getCloudBackupStatus());
}
