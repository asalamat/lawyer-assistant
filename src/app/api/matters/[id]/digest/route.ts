import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generateMatterDigest } from "@/lib/claude";
import { generationKey, trackGeneration } from "@/lib/generationTracker";
import { addDigest, findUnverifiedCitations, getMatter, getMatterDocumentSections, listDigests } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const digests = await listDigests(id);
  return NextResponse.json(digests);
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
    const result = await trackGeneration(generationKey("digest", id), async () => {
      const sections = await getMatterDocumentSections(id);
      const content = await generateMatterDigest(sections);
      const digest = await addDigest(id, content);
      const unverifiedCitations = await findUnverifiedCitations(id, content);
      return { ...digest, unverifiedCitations };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
