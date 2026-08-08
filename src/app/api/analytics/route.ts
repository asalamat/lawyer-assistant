import { NextResponse } from "next/server";
import { getFirmAnalytics } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role === "staff") {
    return NextResponse.json({ error: "Only admins and lawyers can view firm analytics" }, { status: 403 });
  }
  return NextResponse.json(await getFirmAnalytics());
}
