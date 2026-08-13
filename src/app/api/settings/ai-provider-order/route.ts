import { NextResponse } from "next/server";
import { getAiProviderOrder, setAiProviderOrder } from "@/lib/settings";
import type { AiProvider } from "@/lib/settings";

const VALID_PROVIDERS: AiProvider[] = ["anthropic", "openai", "gemini", "ollama"];

export async function GET() {
  const order = await getAiProviderOrder();
  return NextResponse.json({ order });
}

export async function POST(request: Request) {
  const body = await request.json();
  const order = body?.order;

  if (
    !Array.isArray(order) ||
    order.length === 0 ||
    !order.every((p) => VALID_PROVIDERS.includes(p)) ||
    new Set(order).size !== order.length
  ) {
    return NextResponse.json(
      { error: `order must be a non-empty list of unique values from ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 },
    );
  }

  await setAiProviderOrder(order);
  return NextResponse.json({ order });
}
