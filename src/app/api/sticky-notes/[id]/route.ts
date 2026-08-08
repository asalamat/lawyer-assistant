import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteStickyNote, updateStickyNote } from "@/lib/stickyNotes";
import { STICKY_NOTE_COLORS, type StickyNoteColor } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const updates: { content?: string; color?: StickyNoteColor; x?: number; y?: number } = {};
  if (typeof body?.content === "string") updates.content = body.content;
  if (STICKY_NOTE_COLORS.includes(body?.color)) updates.color = body.color;
  if (typeof body?.x === "number") updates.x = body.x;
  if (typeof body?.y === "number") updates.y = body.y;

  const note = await updateStickyNote(user.id, id, updates);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteStickyNote(user.id, id);
  return NextResponse.json({ success: true });
}
