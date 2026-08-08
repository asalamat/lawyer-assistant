import { NextResponse } from "next/server";
import { getFirmAnalytics } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "staff") {
    return NextResponse.json({ error: "Only admins and lawyers can view firm analytics" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const matterType = searchParams.get("matterType") || undefined;

  return NextResponse.json(await getFirmAnalytics({ dateFrom, dateTo, matterType }));
}
