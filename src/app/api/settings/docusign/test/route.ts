import { NextResponse } from "next/server";
import { testDocuSignConnection } from "@/lib/docusign";

export async function POST() {
  try {
    const result = await testDocuSignConnection();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Connection failed" },
      { status: 400 },
    );
  }
}
