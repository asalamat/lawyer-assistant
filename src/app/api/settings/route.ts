import { NextResponse } from "next/server";
import { getAnthropicApiKeyStatus, setAnthropicApiKey } from "@/lib/settings";

export async function GET() {
  const status = await getAnthropicApiKeyStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const body = await request.json();
  const anthropicApiKey = body?.anthropicApiKey;

  if (typeof anthropicApiKey !== "string" || !anthropicApiKey.trim()) {
    return NextResponse.json(
      { error: "anthropicApiKey is required" },
      { status: 400 },
    );
  }

  await setAnthropicApiKey(anthropicApiKey.trim());
  const status = await getAnthropicApiKeyStatus();
  return NextResponse.json(status);
}
