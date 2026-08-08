import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMatter } from "@/lib/matters";
import { addPortalMessage, listPortalMessages, markPortalMessagesRead } from "@/lib/portalMessages";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const messages = await listPortalMessages(id);
  await markPortalMessagesRead(id, "staff");
  return NextResponse.json(messages);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const user = await getCurrentUser();
  const body = await request.json().catch(() => null);
  if (typeof body?.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  try {
    const message = await addPortalMessage(id, "staff", user?.id ?? null, body.content);
    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message" },
      { status: 400 },
    );
  }
}
