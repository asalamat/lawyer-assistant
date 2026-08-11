import { NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/calendar";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await markNotificationRead(id);
  return NextResponse.json({ ok: true });
}
