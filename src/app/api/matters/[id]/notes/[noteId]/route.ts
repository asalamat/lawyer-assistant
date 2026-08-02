import { NextResponse } from "next/server";
import { deleteMatterNote } from "@/lib/matters";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const { id, noteId } = await params;
  await deleteMatterNote(id, noteId);
  return NextResponse.json({ ok: true });
}
