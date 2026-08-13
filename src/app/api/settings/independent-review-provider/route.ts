import { NextResponse } from "next/server";
import {
  getAiProviderOrder,
  getIndependentReviewProvider,
  setIndependentReviewProvider,
  type IndependentReviewProvider,
} from "@/lib/settings";

const VALID_PROVIDERS: IndependentReviewProvider[] = ["openai", "deepseek", "moonshot"];

export async function GET() {
  const [provider, primaryOrder] = await Promise.all([getIndependentReviewProvider(), getAiProviderOrder()]);
  return NextResponse.json({ provider, samePrimaryProvider: primaryOrder[0] === provider });
}

export async function POST(request: Request) {
  const body = await request.json();
  const provider = body?.provider;
  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: `provider must be one of ${VALID_PROVIDERS.join(", ")}` }, { status: 400 });
  }

  await setIndependentReviewProvider(provider);
  const primaryOrder = await getAiProviderOrder();
  return NextResponse.json({ provider, samePrimaryProvider: primaryOrder[0] === provider });
}
