import { NextResponse } from "next/server";
import { analyzeDocumentPhoto } from "@/lib/matters";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  try {
    const document = await analyzeDocumentPhoto(id, docId);
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    return NextResponse.json(document);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Photo analysis failed" },
      { status: 400 },
    );
  }
}
