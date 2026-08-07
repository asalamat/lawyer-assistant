import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { confirmTotpEnrollment, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const code = body?.code;
  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  try {
    const backupCodes = await confirmTotpEnrollment(user.id, code);
    await recordAuditEvent("mfa_enabled", null, `${user.name} enabled two-factor authentication`);
    return NextResponse.json({ backupCodes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not confirm code" },
      { status: 400 },
    );
  }
}
