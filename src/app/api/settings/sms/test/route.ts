import { NextResponse } from "next/server";
import { verifyTwilioConnection } from "@/lib/sms";

export async function GET() {
  try {
    await verifyTwilioConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
