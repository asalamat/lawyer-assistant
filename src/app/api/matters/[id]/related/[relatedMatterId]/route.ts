import { NextResponse } from "next/server";
import { removeRelatedMatter } from "@/lib/relatedMatters";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; relatedMatterId: string }> },
) {
  const { id, relatedMatterId } = await params;
  const removed = await removeRelatedMatter(id, relatedMatterId);
  if (!removed) {
    return NextResponse.json({ error: "These matters aren't linked" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
