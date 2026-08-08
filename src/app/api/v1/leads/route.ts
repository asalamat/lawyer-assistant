import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/apiV1Auth";
import { createLead, listLeads } from "@/lib/leads";

export async function GET(request: Request) {
  if (!(await requireApiKey(request))) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  return NextResponse.json(await listLeads());
}

export async function POST(request: Request) {
  if (!(await requireApiKey(request))) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const lead = await createLead({
      name: body.name,
      email: typeof body.email === "string" ? body.email : null,
      phone: typeof body.phone === "string" ? body.phone : null,
      source: typeof body.source === "string" ? body.source : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create lead" },
      { status: 400 },
    );
  }
}
