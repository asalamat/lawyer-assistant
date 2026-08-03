import { NextResponse } from "next/server";
import { deleteReferenceDocument } from "@/lib/referenceLibrary";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteReferenceDocument(id);
  return NextResponse.json({ ok: true });
}
