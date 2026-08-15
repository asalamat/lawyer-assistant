import { NextResponse } from "next/server";
import { testStripeConnection } from "@/lib/stripe";

export async function GET() {
  try {
    await testStripeConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
