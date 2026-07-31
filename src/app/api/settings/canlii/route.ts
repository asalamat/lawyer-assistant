import { NextResponse } from "next/server";
import { getCanliiApiKeyStatus, setCanliiApiKey } from "@/lib/settings";

export async function GET() {
  const status = await getCanliiApiKeyStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const body = await request.json();
  const canliiApiKey = body?.canliiApiKey;

  if (typeof canliiApiKey !== "string" || !canliiApiKey.trim()) {
    return NextResponse.json({ error: "canliiApiKey is required" }, { status: 400 });
  }

  await setCanliiApiKey(canliiApiKey.trim());
  const status = await getCanliiApiKeyStatus();
  return NextResponse.json(status);
}
