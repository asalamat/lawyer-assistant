import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generateDisclosureChecklist } from "@/lib/claude";
import { addDisclosureChecklist, getMatter, getMatterDocumentSections, listDisclosureChecklists } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listDisclosureChecklists(id));
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
    const content = await generateDisclosureChecklist(sections);
    const doc = await addDisclosureChecklist(id, content);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
