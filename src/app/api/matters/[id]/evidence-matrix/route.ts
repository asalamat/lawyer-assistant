import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { generateEvidenceMatrix } from "@/lib/claude";
import { addEvidenceMatrix, getMatter, getMatterTextContext, listEvidenceMatrices } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matrices = await listEvidenceMatrices(id);
  return NextResponse.json(matrices);
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
    const content = await generateEvidenceMatrix(context);
    const matrix = await addEvidenceMatrix(id, content);
    return NextResponse.json(matrix, { status: 201 });
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
