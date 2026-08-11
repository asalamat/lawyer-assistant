import { NextResponse } from "next/server";
import { countUnreadNotifications, listNotifications } from "@/lib/calendar";

export async function GET() {
  const [items, unreadCount] = await Promise.all([listNotifications(20), countUnreadNotifications()]);
  return NextResponse.json({ items, unreadCount });
}
