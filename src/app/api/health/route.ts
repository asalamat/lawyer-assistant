import { NextResponse } from "next/server";
import { getHealthStatus } from "@/lib/health";

export async function GET() {
  const status = await getHealthStatus();
  return NextResponse.json(status);
}
