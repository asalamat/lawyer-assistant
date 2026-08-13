import { NextResponse } from "next/server";
import { getMoonshotApiKeyStatus, setMoonshotApiKey } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getMoonshotApiKeyStatus());
}

export async function POST(request: Request) {
  const body = await request.json();
  const moonshotApiKey = body?.moonshotApiKey;

  if (typeof moonshotApiKey !== "string" || !moonshotApiKey.trim()) {
    return NextResponse.json({ error: "moonshotApiKey is required" }, { status: 400 });
  }

  await setMoonshotApiKey(moonshotApiKey.trim());
  return NextResponse.json(await getMoonshotApiKeyStatus());
}
