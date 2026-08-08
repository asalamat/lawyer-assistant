import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { getCurrentUser } from "@/lib/auth";
import { deleteBackup, getBackupPath } from "@/lib/backup";
import { checkExportGuard } from "@/lib/exportGuard";

// A backup is the entire database — the single most sensitive bulk export
// this app can produce. Alerting well below the hard limit means a human
// sees it before an actor gets anywhere near actually being blocked.
const BACKUP_DOWNLOAD_GUARD = { action: "backup_download", alertThreshold: 3, hardLimit: 10 };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const guard = await checkExportGuard(BACKUP_DOWNLOAD_GUARD, user.id, user.name);
  if (!guard.allowed) {
    return NextResponse.json(
      { error: "Too many backup downloads this hour. Try again later." },
      { status: 429, headers: { "Retry-After": String(guard.retryAfterSeconds) } },
    );
  }

  const { fileName } = await params;
  try {
    const filePath = getBackupPath(decodeURIComponent(fileName));
    const data = await readFile(filePath);
    await recordAuditEvent("backup_downloaded", null, `Downloaded backup ${decodeURIComponent(fileName)}`);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup not found" },
      { status: 404 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { fileName } = await params;
  try {
    const decoded = decodeURIComponent(fileName);
    deleteBackup(decoded);
    await recordAuditEvent("backup_deleted", null, `Deleted backup ${decoded}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete backup" },
      { status: 400 },
    );
  }
}
