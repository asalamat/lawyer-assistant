import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generatePrivilegeReview } from "@/lib/claude";
import { generationKey, trackGeneration } from "@/lib/generationTracker";
import { addPrivilegeReview, findUnverifiedCitations, getMatter, getMatterDocumentSections, listPrivilegeReviews } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listPrivilegeReviews(id));
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
    const result = await trackGeneration(generationKey("privilege_review", id), async () => {
      const sections = await getMatterDocumentSections(id);
      const content = await generatePrivilegeReview(sections);
      const doc = await addPrivilegeReview(id, content);
      const unverifiedCitations = await findUnverifiedCitations(id, content);
      return { ...doc, unverifiedCitations };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
