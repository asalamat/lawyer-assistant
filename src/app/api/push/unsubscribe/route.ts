import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unsubscribeUser } from "@/lib/push";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string") {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  await unsubscribeUser(endpoint);
  return NextResponse.json({ ok: true });
}
