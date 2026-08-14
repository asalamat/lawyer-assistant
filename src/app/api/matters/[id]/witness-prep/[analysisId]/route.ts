import { NextResponse } from "next/server";
import { deleteWitnessPrepAnalysis } from "@/lib/matters";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; analysisId: string }> },
) {
  const { id, analysisId } = await params;
  const deleted = await deleteWitnessPrepAnalysis(id, analysisId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
