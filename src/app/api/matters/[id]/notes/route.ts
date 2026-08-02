import { NextResponse } from "next/server";
import { addMatterNote, listMatterNotes } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const notes = await listMatterNotes(id);
  return NextResponse.json(notes);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const content = body?.content;

  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const note = await addMatterNote(id, content.trim());
  return NextResponse.json(note, { status: 201 });
}
