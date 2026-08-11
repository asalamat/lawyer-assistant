import { NextResponse } from "next/server";
import { buildDeadlineIcs } from "@/lib/icsExport";
import { getMatter, listDeadlines } from "@/lib/matters";

// The zero-setup alternative to "Push to calendar" (calendarSync.ts) — a
// downloadable .ics file the browser hands off to whatever calendar app is
// already installed, the same way a Zoom invite works. No Google/
// Microsoft connection needed.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; deadlineId: string }> },
) {
  const { id, deadlineId } = await params;
  const [matter, deadlines] = await Promise.all([getMatter(id), listDeadlines(id)]);
  const deadline = deadlines.find((d) => d.id === deadlineId);
  if (!matter || !deadline) {
    return NextResponse.json({ error: "Deadline not found" }, { status: 404 });
  }
  if (!deadline.dueDate) {
    return NextResponse.json({ error: "This deadline has no due date" }, { status: 400 });
  }

  try {
    const ics = buildDeadlineIcs({
      id: deadline.id,
      description: deadline.description,
      dueDate: deadline.dueDate,
      matterTitle: matter.title,
    });
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="deadline.ics"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not build a calendar file for this deadline" },
      { status: 400 },
    );
  }
}
