import { NextResponse } from "next/server";
import { getQuickBooksStatus, setQuickBooksAppCredentials } from "@/lib/settings";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { clientId, clientSecret, sandbox } = body ?? {};

  if (typeof clientId !== "string" || !clientId.trim()) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (typeof clientSecret !== "string" || !clientSecret) {
    return NextResponse.json({ error: "clientSecret is required" }, { status: 400 });
  }

  await setQuickBooksAppCredentials({
    clientId: clientId.trim(),
    clientSecret,
    sandbox: Boolean(sandbox),
  });

  return NextResponse.json(await getQuickBooksStatus());
}
