import { NextResponse } from "next/server";
import { getClient, listMattersForClient } from "@/lib/clients";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const matters = await listMattersForClient(id);
  return NextResponse.json({ client, matters });
}
