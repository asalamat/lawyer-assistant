import { NextResponse } from "next/server";
import { addParty, listParties } from "@/lib/parties";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listParties(id));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (typeof body?.name !== "string" || typeof body?.role !== "string") {
    return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  }

  try {
    const party = await addParty(id, {
      name: body.name,
      role: body.role,
      email: body.email,
      phone: body.phone,
      notes: body.notes,
    });
    return NextResponse.json(party, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add party" },
      { status: 400 },
    );
  }
}
