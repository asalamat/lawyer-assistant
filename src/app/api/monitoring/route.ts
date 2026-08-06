import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMonitoringSnapshot } from "@/lib/monitoring";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  return NextResponse.json(await getMonitoringSnapshot());
}
