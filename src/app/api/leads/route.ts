import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createLead, listLeads } from "@/lib/leads";

export async function GET() {
  return NextResponse.json(await listLeads());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
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
      assignedToUserId: typeof body.assignedToUserId === "string" ? body.assignedToUserId : (user?.id ?? null),
    });
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create lead" },
      { status: 400 },
    );
  }
}
