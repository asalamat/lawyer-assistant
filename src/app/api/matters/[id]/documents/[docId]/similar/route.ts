import { NextResponse } from "next/server";
import { getSimilarDocuments } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  try {
    const similar = await getSimilarDocuments(id, docId);
    return NextResponse.json(similar);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not compute similar documents" },
      { status: 500 },
    );
  }
}
