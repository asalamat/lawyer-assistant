import { NextResponse } from "next/server";
import { getUpdateStatus, pullLatest } from "@/lib/gitUpdate";

export async function GET() {
  const status = await getUpdateStatus();
  return NextResponse.json(status);
}

export async function POST() {
  const result = await pullLatest();
  return NextResponse.json(result, { status: result.success ? 200 : 409 });
}
