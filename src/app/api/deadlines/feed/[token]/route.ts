import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { buildDeadlineFeedIcs } from "@/lib/icsExport";
import { listAllDeadlinesForFeed } from "@/lib/matters";
import { getOrCreateCalendarFeedSecret } from "@/lib/settings";

// Listed as public in proxy.ts — a calendar app subscribing to this URL
// has no browser session and can't send a custom Authorization header, so
// the secret has to be part of the URL path itself (see
// getOrCreateCalendarFeedSecret in settings.ts). Anyone with this exact
// URL can read the firm's deadline list, so treat it like the cron secret:
// don't share it outside the firm, and regenerate it if it ever leaks.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const expected = await getOrCreateCalendarFeedSecret();

  const providedBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  const valid = providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deadlines = await listAllDeadlinesForFeed();
  const ics = buildDeadlineFeedIcs(
    deadlines.map((d) => ({
      id: d.id,
      description: d.description,
      dueDate: d.dueDate as string,
      matterTitle: d.matterTitle,
    })),
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="lawyer-assistant-deadlines.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
