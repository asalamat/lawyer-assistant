import { NextResponse } from "next/server";
import { getCurrentUser, getUserById, resetUserPassword } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/auditLog";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const temporaryPassword = await resetUserPassword(id);
  await recordAuditEvent("user_password_reset", null, `Reset password for ${target.email}`);
  return NextResponse.json({ temporaryPassword });
}
