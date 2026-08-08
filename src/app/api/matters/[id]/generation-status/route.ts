import { NextResponse } from "next/server";
import { generationKey, isGenerating } from "@/lib/generationTracker";

// Polled by GeneratedDocPanel when it mounts on a page where a generation
// might already be running (e.g. the user navigated away mid-generation and
// came back) — lets the UI show "Still generating…" instead of a plain
// Generate button that would kick off a duplicate.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sourceType = new URL(request.url).searchParams.get("type");
  if (!sourceType) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }
  return NextResponse.json({ inProgress: isGenerating(generationKey(sourceType, id)) });
}
