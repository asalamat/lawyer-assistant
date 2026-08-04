import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBackupPath, restoreBackup } from "@/lib/backup";

// Restore is deliberately not audit-logged in the usual way: the audit log
// itself lives inside data/, which this endpoint replaces wholesale — an
// entry written right before the swap would just be discarded along with
// everything else. The moved-aside data.before-restore-* directory this
// leaves behind is the forensic trail instead.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { fileName, confirm } = body ?? {};

  if (confirm !== "RESTORE") {
    return NextResponse.json(
      { error: "Restore requires confirm: 'RESTORE' in the request body" },
      { status: 400 },
    );
  }
  if (typeof fileName !== "string" || !fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  try {
    const archivePath = getBackupPath(fileName);
    const { movedAsideTo } = await restoreBackup(archivePath);
    return NextResponse.json({
      ok: true,
      movedAsideTo,
      message:
        "Restore complete on disk. The app must be restarted now for this to take effect — the running process still has the old database open.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restore failed" },
      { status: 500 },
    );
  }
}
