import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addStickyNote, listStickyNotes } from "@/lib/stickyNotes";
import { STICKY_NOTE_COLORS, type StickyNoteColor } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pagePath = new URL(request.url).searchParams.get("path");
  if (!pagePath) return NextResponse.json({ error: "path is required" }, { status: 400 });

  return NextResponse.json(await listStickyNotes(user.id, pagePath));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const pagePath = body?.pagePath;
  if (typeof pagePath !== "string" || !pagePath) {
    return NextResponse.json({ error: "pagePath is required" }, { status: 400 });
  }
  const color: StickyNoteColor = STICKY_NOTE_COLORS.includes(body?.color) ? body.color : "yellow";

  const note = await addStickyNote(user.id, pagePath, color);
  return NextResponse.json(note, { status: 201 });
}
