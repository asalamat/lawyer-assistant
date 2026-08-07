import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { extractDeadlines } from "@/lib/claude";
import { getMatter, getMatterDocumentSections, listDeadlines, replaceDeadlines } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deadlines = await listDeadlines(id);
  return NextResponse.json(deadlines);
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
    const extracted = await extractDeadlines(sections);
    const deadlines = await replaceDeadlines(id, extracted);
    return NextResponse.json(deadlines, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
