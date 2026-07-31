import { NextResponse } from "next/server";
import { getGeminiApiKeyStatus, setGeminiApiKey } from "@/lib/settings";

export async function GET() {
  const status = await getGeminiApiKeyStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const body = await request.json();
  const geminiApiKey = body?.geminiApiKey;

  if (typeof geminiApiKey !== "string" || !geminiApiKey.trim()) {
    return NextResponse.json({ error: "geminiApiKey is required" }, { status: 400 });
  }

  await setGeminiApiKey(geminiApiKey.trim());
  const status = await getGeminiApiKeyStatus();
  return NextResponse.json(status);
}
