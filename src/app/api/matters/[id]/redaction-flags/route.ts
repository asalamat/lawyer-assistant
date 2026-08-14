import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generationKey, trackGeneration } from "@/lib/generationTracker";
import { generateRedactionFlags, getMatter, listRedactionFlags } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listRedactionFlags(id));
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

  try {
    const flags = await trackGeneration(generationKey("redaction_flags", id), () => generateRedactionFlags(id));
    return NextResponse.json(flags, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
