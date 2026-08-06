import { NextResponse } from "next/server";
import { createClient, listClients } from "@/lib/clients";

export async function GET() {
  return NextResponse.json(await listClients());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = body?.name;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const client = await createClient({
      name,
      email: body?.email,
      phone: body?.phone,
      notes: body?.notes,
    });
    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create client" },
      { status: 400 },
    );
  }
}
