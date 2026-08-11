import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCalendarEvent, listCalendarEvents } from "@/lib/calendar";

export async function GET(request: Request) {
  const matterId = new URL(request.url).searchParams.get("matterId") ?? undefined;
  return NextResponse.json(await listCalendarEvents(matterId));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => null);
  const title = body?.title;
  const startDate = body?.startDate;
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: "startDate must be a YYYY-MM-DD date" }, { status: 400 });
  }
  const reminderDaysBefore =
    body?.reminderDaysBefore === null || body?.reminderDaysBefore === undefined
      ? null
      : Number(body.reminderDaysBefore);
  if (reminderDaysBefore !== null && (!Number.isInteger(reminderDaysBefore) || reminderDaysBefore < 0)) {
    return NextResponse.json({ error: "reminderDaysBefore must be a non-negative integer" }, { status: 400 });
  }

  const event = await createCalendarEvent({
    matterId: typeof body?.matterId === "string" && body.matterId ? body.matterId : null,
    title: title.trim(),
    description: typeof body?.description === "string" ? body.description.trim() : null,
    startDate,
    endDate: typeof body?.endDate === "string" && body.endDate ? body.endDate : null,
    reminderDaysBefore,
    createdBy: user?.id ?? null,
  });
  return NextResponse.json(event, { status: 201 });
}
