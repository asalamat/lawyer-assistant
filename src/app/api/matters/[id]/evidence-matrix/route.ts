import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generateEvidenceMatrix } from "@/lib/claude";
import { generationKey, trackGeneration } from "@/lib/generationTracker";
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

  try {
    const result = await trackGeneration(generationKey("evidence_matrix", id), async () => {
      const sections = await getMatterDocumentSections(id);
      const content = await generateEvidenceMatrix(sections);
      const matrix = await addEvidenceMatrix(id, content);
      const unverifiedCitations = await findUnverifiedCitations(id, content);
      return { ...matrix, unverifiedCitations };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
