import { NextResponse } from "next/server";
import { getCurrentUser, listUsers, setUserActive, setUserRole, type UserRole } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/auditLog";

const VALID_ROLES: UserRole[] = ["admin", "lawyer", "staff"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const users = await listUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (typeof body?.active === "boolean") {
    if (!body.active) {
      const otherActiveAdmins = users.some(
        (u) => u.id !== id && u.role === "admin" && Boolean(u.active),
      );
      if (target.role === "admin" && !otherActiveAdmins) {
        return NextResponse.json(
          { error: "Can't deactivate the only remaining admin" },
          { status: 400 },
        );
      }
    }
    await setUserActive(id, body.active);
    await recordAuditEvent(
      body.active ? "user_activated" : "user_deactivated",
      null,
      `${body.active ? "Reactivated" : "Deactivated"} account for ${target.email}`,
    );
  }

  if (typeof body?.role === "string") {
    if (!VALID_ROLES.includes(body.role as UserRole)) {
      return NextResponse.json({ error: "role must be admin, lawyer, or staff" }, { status: 400 });
    }
    if (target.role === "admin" && body.role !== "admin") {
      const otherActiveAdmins = users.some(
        (u) => u.id !== id && u.role === "admin" && Boolean(u.active),
      );
      if (!otherActiveAdmins) {
        return NextResponse.json(
          { error: "Can't remove admin from the only remaining admin" },
          { status: 400 },
        );
      }
    }
    await setUserRole(id, body.role as UserRole);
    await recordAuditEvent(
      "user_role_changed",
      null,
      `Changed ${target.email}'s role from ${target.role} to ${body.role}`,
    );
  }

  const updated = (await listUsers()).find((u) => u.id === id);
  return NextResponse.json(updated);
}
