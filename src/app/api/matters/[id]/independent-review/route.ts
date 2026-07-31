import { ApiError } from "@google/genai";
import { NextResponse } from "next/server";
import { getIndependentReview } from "@/lib/gemini";
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

  if (
    (sourceType !== "digest" && sourceType !== "evidence_matrix") ||
    !sourceId ||
    !content
  ) {
    return NextResponse.json(
      { error: "sourceType (digest|evidence_matrix), sourceId, and content are required" },
      { status: 400 },
    );
  }

  const context = await getMatterTextContext(id);
  try {
    const critique = await getIndependentReview(content, context);
    const review = await addIndependentReview(id, sourceType, sourceId, critique);
    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
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
