import { NextResponse } from "next/server";
import { listCaseDatabases } from "@/lib/canlii";

export async function GET() {
  try {
    const databases = await listCaseDatabases();
    return NextResponse.json({ ok: true, databaseCount: databases.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
