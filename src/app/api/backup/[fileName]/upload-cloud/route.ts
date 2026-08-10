import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { getCurrentUser } from "@/lib/auth";
import { getBackupPath } from "@/lib/backup";
import { pruneCloudBackups, uploadBackupToCloud } from "@/lib/cloudBackup";
import { getCloudBackupConfig, recordCloudBackupResult } from "@/lib/settings";

// Manually pushes an already-created local backup up to cloud storage —
// useful right after configuring cloud backup for the first time (so the
// most recent backup doesn't have to wait for the next scheduled run), or
// to retry after a failed automatic upload.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const config = await getCloudBackupConfig();
  if (!config) {
    return NextResponse.json({ error: "Configure cloud backup settings first" }, { status: 400 });
  }

  const { fileName } = await params;
  const decoded = decodeURIComponent(fileName);
  try {
    const filePath = getBackupPath(decoded);
    await uploadBackupToCloud(config, filePath, decoded);
    await pruneCloudBackups(config).catch(() => {
      // A prune failure shouldn't mask a successful upload.
    });
    await recordCloudBackupResult("ok", { fileName: decoded });
    await recordAuditEvent("cloud_backup_uploaded", null, `Uploaded ${decoded} to cloud storage (manual)`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    await recordCloudBackupResult("error", { error: message });
    await recordAuditEvent("cloud_backup_failed", null, `Manual cloud backup upload failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
