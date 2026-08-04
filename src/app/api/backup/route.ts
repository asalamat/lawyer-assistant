import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { getCurrentUser } from "@/lib/auth";
import { createBackup, listBackups } from "@/lib/backup";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return NextResponse.json(await listBackups());
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  try {
    const backup = await createBackup();
    await recordAuditEvent("backup_created", null, `Created backup ${backup.fileName}`);
    return NextResponse.json(backup, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create backup" },
      { status: 500 },
    );
  }
}
