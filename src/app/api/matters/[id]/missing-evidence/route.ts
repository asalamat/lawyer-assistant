import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generationKey, trackGeneration } from "@/lib/generationTracker";
import {
  findUnverifiedCitations,
  generateMissingEvidenceReport,
  getMatter,
  getMissingEvidenceSources,
  listMissingEvidenceReports,
} from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listMissingEvidenceReports(id));
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

  const sources = await getMissingEvidenceSources(id);
  if (sources.length === 0) {
    return NextResponse.json(
      {
        error:
          "Generate a digest, disclosure checklist, evidence matrix, or Crown position analysis first, then generate this to roll up everything flagged as missing across them.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await trackGeneration(generationKey("missing_evidence_report", id), async () => {
      const doc = await generateMissingEvidenceReport(id, sources);
      const unverifiedCitations = await findUnverifiedCitations(id, doc.content);
      return { ...doc, unverifiedCitations };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
