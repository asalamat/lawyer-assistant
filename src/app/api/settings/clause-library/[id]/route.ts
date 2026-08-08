import { NextResponse } from "next/server";
import { deleteClauseLibraryEntry } from "@/lib/clauseLibrary";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteClauseLibraryEntry(id);
  return NextResponse.json({ success: true });
}
