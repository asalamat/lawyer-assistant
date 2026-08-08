import { NextResponse } from "next/server";
import { pushDeadlineToCalendar } from "@/lib/calendarSync";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; deadlineId: string }> },
) {
  const { id, deadlineId } = await params;
  try {
    const deadline = await pushDeadlineToCalendar(id, deadlineId);
    return NextResponse.json(deadline);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to push to calendar" },
      { status: 400 },
    );
  }
}
