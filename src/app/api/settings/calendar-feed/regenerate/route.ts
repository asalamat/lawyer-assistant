import { NextResponse } from "next/server";
import { regenerateCalendarFeedSecret } from "@/lib/settings";

export async function POST() {
  const secret = await regenerateCalendarFeedSecret();
  return NextResponse.json({ secret });
}
