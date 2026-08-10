import { NextResponse } from "next/server";
import { getChangeBackupStatus, setChangeBackupConfig } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getChangeBackupStatus());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const enabled = Boolean(body?.enabled);
  const debounceMinutes = Number(body?.debounceMinutes);
  const cooldownMinutes = Number(body?.cooldownMinutes);

  if (!Number.isFinite(debounceMinutes) || debounceMinutes < 1 || debounceMinutes > 60) {
    return NextResponse.json({ error: "debounceMinutes must be between 1 and 60" }, { status: 400 });
  }
  if (!Number.isFinite(cooldownMinutes) || cooldownMinutes < 1 || cooldownMinutes > 1440) {
    return NextResponse.json({ error: "cooldownMinutes must be between 1 and 1440 (one day)" }, { status: 400 });
  }

  await setChangeBackupConfig({ enabled, debounceMinutes, cooldownMinutes });
  return NextResponse.json(await getChangeBackupStatus());
}
