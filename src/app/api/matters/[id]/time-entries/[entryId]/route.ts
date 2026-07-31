import { NextResponse } from "next/server";
import { deleteTimeEntry } from "@/lib/matters";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params;
  try {
    await deleteTimeEntry(id, entryId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
