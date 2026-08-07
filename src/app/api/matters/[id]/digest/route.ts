import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { generateMatterDigest } from "@/lib/claude";
import { addDigest, getMatter, getMatterTextContext, listDigests } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const digests = await listDigests(id);
  return NextResponse.json(digests);
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
    const content = await generateMatterDigest(context);
    const digest = await addDigest(id, content);
    return NextResponse.json(digest, { status: 201 });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
