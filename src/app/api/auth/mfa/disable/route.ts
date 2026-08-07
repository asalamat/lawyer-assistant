import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { disableTotp, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const currentPassword = body?.currentPassword;
  if (typeof currentPassword !== "string" || !currentPassword) {
    return NextResponse.json({ error: "currentPassword is required" }, { status: 400 });
  }

  const ok = await disableTotp(user.id, currentPassword);
  if (!ok) return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  await recordAuditEvent("mfa_disabled", null, `${user.name} disabled two-factor authentication`);
  return NextResponse.json({ success: true });
}
