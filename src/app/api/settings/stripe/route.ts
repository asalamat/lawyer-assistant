import { NextResponse } from "next/server";
import { getStripeStatus, setStripeConfig } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getStripeStatus());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { secretKey, publishableKey } = body ?? {};

  if (typeof secretKey !== "string" || !secretKey) {
    return NextResponse.json({ error: "secretKey is required" }, { status: 400 });
  }
  if (typeof publishableKey !== "string" || !publishableKey.trim()) {
    return NextResponse.json({ error: "publishableKey is required" }, { status: 400 });
  }

  await setStripeConfig({ secretKey, publishableKey: publishableKey.trim() });
  return NextResponse.json(await getStripeStatus());
}
