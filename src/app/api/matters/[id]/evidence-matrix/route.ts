import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generateEvidenceMatrix } from "@/lib/claude";
import { addEvidenceMatrix, findUnverifiedCitations, getMatter, getMatterDocumentSections, listEvidenceMatrices } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matrices = await listEvidenceMatrices(id);
  return NextResponse.json(matrices);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const sections = await getMatterDocumentSections(id);
  try {
    const content = await generateEvidenceMatrix(sections);
    const matrix = await addEvidenceMatrix(id, content);
    const unverifiedCitations = await findUnverifiedCitations(id, content);
    return NextResponse.json({ ...matrix, unverifiedCitations }, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
