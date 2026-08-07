import { NextResponse } from "next/server";
import { deleteParty, getParty, updateParty } from "@/lib/parties";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; partyId: string }> },
) {
  const { id, partyId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A JSON body is required" }, { status: 400 });
  }

  const existing = await getParty(partyId);
  if (!existing || existing.matterId !== id) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  try {
    const party = await updateParty(partyId, {
      name: body.name,
      role: body.role,
      email: body.email,
      phone: body.phone,
      notes: body.notes,
    });
    return NextResponse.json(party);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update party" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; partyId: string }> },
) {
  const { id, partyId } = await params;
  const existing = await getParty(partyId);
  if (!existing || existing.matterId !== id) {
    return NextResponse.json({ error: "Party not found" }, { status: 404 });
  }

  await deleteParty(partyId);
  return NextResponse.json({ ok: true });
}
