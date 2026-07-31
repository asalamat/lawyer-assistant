import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { extractDeadlines } from "@/lib/claude";
import { getMatter, getMatterTextContext, listDeadlines, replaceDeadlines } from "@/lib/matters";

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

  const context = await getMatterTextContext(id);
  try {
    const extracted = await extractDeadlines(context);
    const deadlines = await replaceDeadlines(id, extracted);
    return NextResponse.json(deadlines, { status: 201 });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error: ${err.message}` },
        { status: err.status ?? 502 },
      );
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
