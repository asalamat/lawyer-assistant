import { NextResponse } from "next/server";
import { deleteCalendarEvent } from "@/lib/calendar";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteCalendarEvent(id);
  return NextResponse.json({ ok: true });
}
