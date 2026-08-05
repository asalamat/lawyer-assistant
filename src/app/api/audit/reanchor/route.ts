import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reanchorAuditLogIntegrity } from "@/lib/auditLog";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json(
      { error: "A reason is required — this is recorded permanently in the audit log." },
      { status: 400 },
    );
  }

  const result = await reanchorAuditLogIntegrity(reason);
  return NextResponse.json(result);
}
