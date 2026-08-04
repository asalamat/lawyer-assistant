import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyAuditLogIntegrity } from "@/lib/auditLog";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return NextResponse.json(await verifyAuditLogIntegrity());
}
