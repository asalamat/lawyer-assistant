import { NextResponse } from "next/server";
import { getAiProviderOrder, setAiProviderOrder } from "@/lib/settings";
import type { AiProvider } from "@/lib/settings";

const VALID_PROVIDERS: AiProvider[] = ["anthropic", "openai", "gemini"];

export async function GET() {
  const order = await getAiProviderOrder();
  return NextResponse.json({ order });
}

export async function POST(request: Request) {
  const body = await request.json();
  const order = body?.order;

  if (
    !Array.isArray(order) ||
    order.length !== VALID_PROVIDERS.length ||
    !VALID_PROVIDERS.every((p) => order.includes(p))
  ) {
    return NextResponse.json(
      { error: `order must include exactly: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 },
    );
  }

  await setAiProviderOrder(order);
  return NextResponse.json({ order });
}
