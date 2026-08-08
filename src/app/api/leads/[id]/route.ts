import { NextResponse } from "next/server";
import { deleteLead, getLead, updateLead } from "@/lib/leads";
import { LEAD_STAGES } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body?.stage !== undefined && !LEAD_STAGES.includes(body.stage)) {
    return NextResponse.json({ error: `stage must be one of: ${LEAD_STAGES.join(", ")}` }, { status: 400 });
  }

  try {
    const lead = await updateLead(id, {
      name: typeof body?.name === "string" ? body.name : undefined,
      email: body?.email !== undefined ? body.email : undefined,
      phone: body?.phone !== undefined ? body.phone : undefined,
      source: body?.source !== undefined ? body.source : undefined,
      stage: body?.stage,
      notes: body?.notes !== undefined ? body.notes : undefined,
      assignedToUserId: body?.assignedToUserId !== undefined ? body.assignedToUserId : undefined,
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    return NextResponse.json(lead);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update lead" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteLead(id);
  return NextResponse.json({ success: true });
}
