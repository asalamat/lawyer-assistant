import { NextResponse } from "next/server";
import { attachReferenceDocument, listAttachedReferenceDocuments } from "@/lib/referenceLibrary";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const documents = await listAttachedReferenceDocuments(id);
  return NextResponse.json(documents);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const referenceDocumentId = body?.referenceDocumentId;

  if (typeof referenceDocumentId !== "string" || !referenceDocumentId) {
    return NextResponse.json({ error: "referenceDocumentId is required" }, { status: 400 });
  }

  try {
    await attachReferenceDocument(id, referenceDocumentId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to attach reference document";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
