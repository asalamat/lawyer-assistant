import { NextResponse } from "next/server";
import { deleteMatterRequirement, getMatterRequirement, toggleMatterRequirementComplete } from "@/lib/matterRequirements";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params;
  const body = await request.json().catch(() => null);

  if (typeof body?.completed !== "boolean") {
    return NextResponse.json({ error: "completed must be a boolean" }, { status: 400 });
  }

  const item = await toggleMatterRequirementComplete(itemId, body.completed);
  if (!item) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const { itemId } = await params;
  const existing = await getMatterRequirement(itemId);
  if (!existing) return NextResponse.json({ error: "Requirement not found" }, { status: 404 });

  await deleteMatterRequirement(itemId);
  return NextResponse.json({ success: true });
}
