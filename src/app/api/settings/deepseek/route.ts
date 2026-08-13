import { NextResponse } from "next/server";
import { getDeepseekApiKeyStatus, setDeepseekApiKey } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getDeepseekApiKeyStatus());
}

export async function POST(request: Request) {
  const body = await request.json();
  const deepseekApiKey = body?.deepseekApiKey;

  if (typeof deepseekApiKey !== "string" || !deepseekApiKey.trim()) {
    return NextResponse.json({ error: "deepseekApiKey is required" }, { status: 400 });
  }

  await setDeepseekApiKey(deepseekApiKey.trim());
  return NextResponse.json(await getDeepseekApiKeyStatus());
}
