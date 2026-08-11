import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { subscribeUser } from "@/lib/push";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await subscribeUser(user.id, { endpoint, keys: { p256dh, auth } });
  return NextResponse.json({ ok: true });
}
