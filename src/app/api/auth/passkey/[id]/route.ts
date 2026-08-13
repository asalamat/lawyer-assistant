import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteCredential } from "@/lib/webauthn";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteCredential(user.id, id);
  if (!deleted) return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
