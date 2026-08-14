import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generateWitnessPrepQuestions } from "@/lib/claude";
import { generationKey, trackGeneration } from "@/lib/generationTracker";
import { addWitnessPrepAnalysis, findUnverifiedCitations, getMatter, getMatterDocumentSections, listWitnessPrepAnalyses } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listWitnessPrepAnalyses(id));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const witnessName = typeof body.witnessName === "string" ? body.witnessName.trim() : "";
  if (!witnessName) {
    return NextResponse.json({ error: "witnessName is required" }, { status: 400 });
  }

  try {
    const result = await trackGeneration(generationKey(`witness_prep:${witnessName}`, id), async () => {
      const sections = await getMatterDocumentSections(id);
      const content = await generateWitnessPrepQuestions(sections, witnessName);
      const doc = await addWitnessPrepAnalysis(id, witnessName, content);
      const unverifiedCitations = await findUnverifiedCitations(id, content);
      return { ...doc, unverifiedCitations };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
