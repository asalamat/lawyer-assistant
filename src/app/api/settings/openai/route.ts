import { NextResponse } from "next/server";
import { getOpenaiApiKeyStatus, setOpenaiApiKey } from "@/lib/settings";

export async function GET() {
  const status = await getOpenaiApiKeyStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const body = await request.json();
  const openaiApiKey = body?.openaiApiKey;

  if (typeof openaiApiKey !== "string" || !openaiApiKey.trim()) {
    return NextResponse.json({ error: "openaiApiKey is required" }, { status: 400 });
  }

  await setOpenaiApiKey(openaiApiKey.trim());
  const status = await getOpenaiApiKeyStatus();
  return NextResponse.json(status);
}
