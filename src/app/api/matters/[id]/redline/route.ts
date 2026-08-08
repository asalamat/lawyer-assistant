import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generateRedlineAnalysis } from "@/lib/claude";
import { listClauseLibraryEntries } from "@/lib/clauseLibrary";
import { generationKey, trackGeneration } from "@/lib/generationTracker";
import { addRedlineAnalysis, findUnverifiedCitations, getMatter, getMatterDocumentSections, listRedlineAnalyses } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listRedlineAnalyses(id));
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
    const result = await trackGeneration(generationKey("redline_analysis", id), async () => {
      const sections = await getMatterDocumentSections(id);
      const clauseLibrary = await listClauseLibraryEntries();
      const content = await generateRedlineAnalysis(sections, clauseLibrary);
      const doc = await addRedlineAnalysis(id, content);
      const unverifiedCitations = await findUnverifiedCitations(id, content);
      return { ...doc, unverifiedCitations };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
