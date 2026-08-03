import { NextResponse } from "next/server";
import { detachReferenceDocument } from "@/lib/referenceLibrary";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; refId: string }> },
) {
  const { id, refId } = await params;
  await detachReferenceDocument(id, refId);
  return NextResponse.json({ ok: true });
}
