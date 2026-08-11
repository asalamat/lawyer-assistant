import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasActivePushSubscription } from "@/lib/push";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ subscribed: await hasActivePushSubscription(user.id) });
}
