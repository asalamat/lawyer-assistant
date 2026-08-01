import { NextResponse } from "next/server";
import { verifyEmailConnection } from "@/lib/email";

export async function GET() {
  try {
    await verifyEmailConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
