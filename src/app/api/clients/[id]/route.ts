import { NextResponse } from "next/server";
import { deleteClient, getClient, listMattersForClient, updateClient } from "@/lib/clients";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const matters = await listMattersForClient(id);
  return NextResponse.json({ client, matters });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body?.name !== undefined && !String(body.name).trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const client = await updateClient(id, {
      name: body?.name,
      email: body?.email,
      phone: body?.phone,
      notes: body?.notes,
    });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    return NextResponse.json(client);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update client" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deleted = await deleteClient(id);
    if (!deleted) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete client" },
      { status: 400 },
    );
  }
}
