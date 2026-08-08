import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generateCrownPositionAnalysis } from "@/lib/claude";
import { generationKey, trackGeneration } from "@/lib/generationTracker";
import { addCrownPositionAnalysis, findUnverifiedCitations, getMatter, getMatterDocumentSections, listCrownPositionAnalyses } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listCrownPositionAnalyses(id));
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
    const result = await trackGeneration(generationKey("crown_position_analysis", id), async () => {
      const sections = await getMatterDocumentSections(id);
      const content = await generateCrownPositionAnalysis(sections);
      const doc = await addCrownPositionAnalysis(id, content);
      const unverifiedCitations = await findUnverifiedCitations(id, content);
      return { ...doc, unverifiedCitations };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
