import { NextResponse } from "next/server";
import { addMatterRequirement, listMatterRequirements } from "@/lib/matterRequirements";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await listMatterRequirements(id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (typeof body?.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "A label is required" }, { status: 400 });
  }

  try {
    const item = await addMatterRequirement(id, body.label);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add requirement" },
      { status: 400 },
    );
  }
}
