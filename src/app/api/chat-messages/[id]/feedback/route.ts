import { NextResponse } from "next/server";
import { setMessageFeedback } from "@/lib/matters";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const rating = body?.rating;

  if (rating !== "up" && rating !== "down") {
    return NextResponse.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
  }

  const feedback = await setMessageFeedback(id, rating);
  return NextResponse.json(feedback, { status: 201 });
}
