import { NextResponse } from "next/server";
import { setDocumentSharedWithClient } from "@/lib/matters";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.shared !== "boolean") {
    return NextResponse.json({ error: "shared (boolean) is required" }, { status: 400 });
  }

  try {
    await setDocumentSharedWithClient(id, docId, body.shared, new URL(request.url).origin);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update sharing" },
      { status: 400 },
    );
  }
}
