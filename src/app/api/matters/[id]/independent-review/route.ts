import { APIError } from "openai";
import { NextResponse } from "next/server";
import { getIndependentReview } from "@/lib/openaiText";
import {
  addIndependentReview,
  getMatter,
  getMatterTextContext,
  listIndependentReviews,
} from "@/lib/matters";
import type { IndependentReview } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reviews = await listIndependentReviews(id);
  return NextResponse.json(reviews);
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

  const body = (await request.json()) as {
    sourceType?: IndependentReview["sourceType"];
    sourceId?: string;
    content?: string;
  };
  const { sourceType, sourceId, content } = body;

  const validSourceTypes: IndependentReview["sourceType"][] = [
    "digest",
    "evidence_matrix",
    "chat_message",
  ];
  if (!sourceType || !validSourceTypes.includes(sourceType) || !sourceId || !content) {
    return NextResponse.json(
      { error: "sourceType (digest|evidence_matrix|chat_message), sourceId, and content are required" },
      { status: 400 },
    );
  }

  const context = await getMatterTextContext(id);
  try {
    const critique = await getIndependentReview(content, context);
    const review = await addIndependentReview(id, sourceType, sourceId, critique);
    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    if (err instanceof APIError) {
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
