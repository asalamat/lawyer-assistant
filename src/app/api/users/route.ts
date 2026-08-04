import { NextResponse } from "next/server";
import { createUser, getCurrentUser, listUsers, type UserRole } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/auditLog";

const VALID_ROLES: UserRole[] = ["admin", "lawyer", "staff"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return NextResponse.json(await listUsers());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await request.json();
  const email = body?.email;
  const name = body?.name;
  const role = body?.role;

  if (typeof email !== "string" || !email.trim() || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "email and name are required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "role must be admin, lawyer, or staff" }, { status: 400 });
  }

  try {
    const { user: created, temporaryPassword } = await createUser({ email, name, role });
    await recordAuditEvent("user_created", null, `Created ${role} account for ${created.email}`);
    return NextResponse.json({ user: created, temporaryPassword });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not create user" },
      { status: 400 },
    );
  }
}
