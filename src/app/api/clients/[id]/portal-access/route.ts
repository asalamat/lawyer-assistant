import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { getClientUserForClient, grantOrResetPortalAccess } from "@/lib/clientAuth";
import { getClient } from "@/lib/clients";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientUser = await getClientUserForClient(id);
  return NextResponse.json({ clientUser });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : client.email;
  if (!email) {
    return NextResponse.json(
      { error: "This client has no email on file — add one first or provide one here" },
      { status: 400 },
    );
  }

  const wasAlreadyGranted = Boolean(await getClientUserForClient(id));
  try {
    const { user, temporaryPassword } = await grantOrResetPortalAccess(id, email);
    await recordAuditEvent(
      wasAlreadyGranted ? "client_portal_password_reset" : "client_portal_access_granted",
      null,
      `${wasAlreadyGranted ? "Reset portal password for" : "Granted portal access to"} "${client.name}" (${user.email})`,
    );
    return NextResponse.json({ clientUser: user, temporaryPassword });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to grant portal access" },
      { status: 400 },
    );
  }
}
