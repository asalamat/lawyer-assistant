import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { checkAllLegislationWatches } from "@/lib/legislationWatch";
import { getOrCreateCronSecret } from "@/lib/settings";

// This route is listed as public in proxy.ts (no browser session exists for
// an unattended cron job) and instead checks a bearer token against a
// separate cron secret — see Settings > Legal research for the value and
// an example cron command.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const expected = await getOrCreateCronSecret();

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  const valid =
    providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);

  if (!provided || !valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await checkAllLegislationWatches();
  return NextResponse.json({
    checked: results.length,
    changed: results.filter((r) => r.changed).length,
    errors: results.filter((r) => r.error).map((r) => ({ label: r.watch.label, error: r.error })),
  });
}
