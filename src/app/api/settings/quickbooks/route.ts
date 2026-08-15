import { NextResponse } from "next/server";
import { getQuickBooksStatus } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getQuickBooksStatus());
}
