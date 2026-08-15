import { NextResponse } from "next/server";
import { disconnectQuickBooks, getQuickBooksStatus } from "@/lib/settings";

export async function POST() {
  await disconnectQuickBooks();
  return NextResponse.json(await getQuickBooksStatus());
}
