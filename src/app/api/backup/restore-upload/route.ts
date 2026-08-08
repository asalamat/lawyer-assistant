import { randomUUID } from "crypto";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { restoreBackup } from "@/lib/backup";

const BACKUPS_DIR = path.join(process.cwd(), "backups");

// Restores from a backup file the admin browses to and uploads, rather than
// one already sitting in this app's own backups/ list — e.g. one downloaded
// earlier, copied in from another machine, or from before a migration.
// Written to a throwaway temp file (not added to the kept-backups rotation)
// since restoreBackup() just needs a real path on disk to extract from; the
// upload itself isn't something worth keeping once the swap is done.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  if (formData.get("confirm") !== "RESTORE") {
    return NextResponse.json(
      { error: "Restore requires confirm: 'RESTORE' in the request" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A backup file is required" }, { status: 400 });
  }
  if (!file.name.endsWith(".tar.gz")) {
    return NextResponse.json(
      { error: "Expected a .tar.gz backup file (the format 'Backup now' produces)" },
      { status: 400 },
    );
  }

  mkdirSync(BACKUPS_DIR, { recursive: true });
  const tempPath = path.join(BACKUPS_DIR, `.uploaded-${randomUUID()}.tar.gz`);
  try {
    writeFileSync(tempPath, Buffer.from(await file.arrayBuffer()));
    const { movedAsideTo } = await restoreBackup(tempPath);
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
  } finally {
    rmSync(tempPath, { force: true });
  }
}
