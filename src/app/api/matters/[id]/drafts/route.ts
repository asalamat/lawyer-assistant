import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { generateDraft } from "@/lib/claude";
import { addDraft, getMatter, getMatterTextContext, listDrafts } from "@/lib/matters";
import { DRAFT_TYPES, type DraftType } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const drafts = await listDrafts(id);
  return NextResponse.json(drafts);
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

  const body = await request.json();
  const draftType = body?.draftType as DraftType;
  const instructions = typeof body?.instructions === "string" ? body.instructions : "";

  if (!DRAFT_TYPES.includes(draftType)) {
    return NextResponse.json(
      { error: `draftType must be one of: ${DRAFT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const context = await getMatterTextContext(id);
  try {
    const content = await generateDraft(draftType, context, instructions);
    const draft = await addDraft(id, draftType, content);
    return NextResponse.json(draft, { status: 201 });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error: ${err.message}` },
        { status: err.status ?? 502 },
      );
    }
    if (err instanceof Error && err.message.includes("No Anthropic API key")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
