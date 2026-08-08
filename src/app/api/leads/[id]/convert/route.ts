import { NextResponse } from "next/server";
import { convertLeadToMatter } from "@/lib/leads";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof body?.matterType !== "string" || !body.matterType.trim()) {
    return NextResponse.json({ error: "matterType is required" }, { status: 400 });
  }

  try {
    const result = await convertLeadToMatter(id, { title: body.title, matterType: body.matterType });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to convert lead" },
      { status: 400 },
    );
  }
}
