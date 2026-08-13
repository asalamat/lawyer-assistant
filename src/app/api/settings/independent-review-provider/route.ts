import { NextResponse } from "next/server";
import {
  getAiProviderOrder,
  getIndependentReviewProviderOrder,
  setIndependentReviewProviderOrder,
  type IndependentReviewProvider,
} from "@/lib/settings";

const VALID_PROVIDERS: IndependentReviewProvider[] = [
  "anthropic",
  "openai",
  "gemini",
  "ollama",
  "deepseek",
  "moonshot",
];

export async function GET() {
  const [order, primaryOrder] = await Promise.all([getIndependentReviewProviderOrder(), getAiProviderOrder()]);
  return NextResponse.json({ order, samePrimaryProvider: primaryOrder[0] === order[0] });
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

  await setIndependentReviewProviderOrder(order);
  const primaryOrder = await getAiProviderOrder();
  return NextResponse.json({ order, samePrimaryProvider: primaryOrder[0] === order[0] });
}
