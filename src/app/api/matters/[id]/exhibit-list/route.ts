import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generateExhibitList } from "@/lib/claude";
import { addExhibitList, findUnverifiedCitations, getMatter, getMatterDocumentSections, listExhibitLists } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listExhibitLists(id));
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
    const content = await generateExhibitList(sections);
    const doc = await addExhibitList(id, content);
    const unverifiedCitations = await findUnverifiedCitations(id, content);
    return NextResponse.json({ ...doc, unverifiedCitations }, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
