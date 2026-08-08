import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runDueSteps } from "@/lib/campaigns";
import { getOrCreateCronSecret } from "@/lib/settings";

// Same shape as /api/backup/scheduled and /api/legislation-watches/
// check-all — meant for an unattended OS cron job, no browser session
// exists there. See Settings > Marketing campaigns for the cron secret
// and an example command.
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

  const result = await runDueSteps();
  return NextResponse.json(result);
}
