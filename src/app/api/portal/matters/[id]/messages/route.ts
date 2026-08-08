import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientSessionUser } from "@/lib/clientAuth";
import { getMatter } from "@/lib/matters";
import { addPortalMessage, listPortalMessages, markPortalMessagesRead } from "@/lib/portalMessages";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = (await cookies()).get("client_session")?.value;
  const clientUser = await getClientSessionUser(token);
  if (!clientUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const matter = await getMatter(id);
  if (!matter || matter.clientId !== clientUser.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const messages = await listPortalMessages(id);
  await markPortalMessagesRead(id, "client");
  return NextResponse.json(messages);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = (await cookies()).get("client_session")?.value;
  const clientUser = await getClientSessionUser(token);
  if (!clientUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const matter = await getMatter(id);
  if (!matter || matter.clientId !== clientUser.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  try {
    const message = await addPortalMessage(id, "client", clientUser.id, body.content);
    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message" },
      { status: 400 },
    );
  }
}
