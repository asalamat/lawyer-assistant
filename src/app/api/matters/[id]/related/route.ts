import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addRelatedMatter, listRelatedMatters } from "@/lib/relatedMatters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listRelatedMatters(id));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (typeof body?.relatedMatterId !== "string" || !body.relatedMatterId.trim()) {
    return NextResponse.json({ error: "relatedMatterId is required" }, { status: 400 });
  }
  if (body.note !== undefined && body.note !== null && typeof body.note !== "string") {
    return NextResponse.json({ error: "note must be a string" }, { status: 400 });
  }

  const user = await getCurrentUser();
  try {
    const link = await addRelatedMatter(
      id,
      body.relatedMatterId.trim(),
      body.note ?? null,
      user?.id ?? null,
    );
    return NextResponse.json(link, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to link matter" },
      { status: 400 },
    );
  }
}
