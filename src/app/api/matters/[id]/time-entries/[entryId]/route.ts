import { NextResponse } from "next/server";
import { deleteTimeEntry } from "@/lib/matters";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params;
  await deleteTimeEntry(id, entryId);
  return NextResponse.json({ ok: true });
}
