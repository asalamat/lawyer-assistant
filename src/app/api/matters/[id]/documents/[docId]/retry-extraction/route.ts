import { NextResponse } from "next/server";
import { retryDocumentExtraction } from "@/lib/matters";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const document = await retryDocumentExtraction(id, docId);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  return NextResponse.json(document);
}
