import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createBackup } from "@/lib/backup";
import { getOrCreateCronSecret } from "@/lib/settings";

// This route is listed as public in proxy.ts (no browser session exists for
// an unattended cron job) and instead checks a bearer token against the
// same cron secret used for the legislation-watch check-all endpoint — see
// Settings > Backup for the value and an example cron/Task Scheduler command.
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

  const backup = await createBackup();
  return NextResponse.json(backup, { status: 201 });
}
