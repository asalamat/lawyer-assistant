import { NextResponse } from "next/server";
import { inspectDocumentPageForQuestion } from "@/lib/matters";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const body = await request.json().catch(() => null);
  const page = Number(body?.page);
  const question = body?.question;

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  try {
    const result = await inspectDocumentPageForQuestion(id, docId, page, question);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Page inspection failed" },
      { status: 400 },
    );
  }
}
