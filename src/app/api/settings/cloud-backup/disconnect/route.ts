import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { disconnectCloudBackup, getCloudBackupStatus } from "@/lib/settings";

export async function POST() {
  const before = await getCloudBackupStatus();
  await disconnectCloudBackup();
  await recordAuditEvent("cloud_backup_disconnected", null, `Disconnected cloud backup storage (was: ${before.provider ?? "none"})`);
  return NextResponse.json(await getCloudBackupStatus());
}
