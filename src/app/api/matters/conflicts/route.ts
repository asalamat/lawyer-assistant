import { NextResponse } from "next/server";
import { checkConflicts } from "@/lib/matters";

export async function GET(request: Request) {
  const clientName = new URL(request.url).searchParams.get("clientName") ?? "";
  const matches = await checkConflicts(clientName);
  return NextResponse.json(matches);
}
