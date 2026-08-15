import { NextResponse } from "next/server";
import { testQuickBooksConnection } from "@/lib/quickbooks";

export async function GET() {
  try {
    const result = await testQuickBooksConnection();
    return NextResponse.json({ ok: true, companyName: result.companyName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
