import { NextResponse } from "next/server";
import { DEFAULT_OLLAMA_BASE_URL, getOllamaConfig, setOllamaConfig } from "@/lib/settings";

export async function GET() {
  const config = await getOllamaConfig();
  return NextResponse.json({
    configured: Boolean(config),
    baseUrl: config?.baseUrl ?? DEFAULT_OLLAMA_BASE_URL,
    model: config?.model ?? "",
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const model = body?.model;
  const baseUrl = typeof body?.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl : DEFAULT_OLLAMA_BASE_URL;

  if (typeof model !== "string" || !model.trim()) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  await setOllamaConfig({ baseUrl, model });
  const config = await getOllamaConfig();
  return NextResponse.json({ configured: Boolean(config), baseUrl: config?.baseUrl, model: config?.model });
}
