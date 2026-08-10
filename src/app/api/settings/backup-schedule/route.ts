import { NextResponse } from "next/server";
import { getBackupScheduleStatus, setBackupScheduleConfig } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getBackupScheduleStatus());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const enabled = Boolean(body?.enabled);
  const intervalHours = Number(body?.intervalHours);

  if (!Number.isFinite(intervalHours) || intervalHours < 1 || intervalHours > 168) {
    return NextResponse.json(
      { error: "intervalHours must be between 1 and 168 (one week)" },
      { status: 400 },
    );
  }

  await setBackupScheduleConfig({ enabled, intervalHours });
  return NextResponse.json(await getBackupScheduleStatus());
}
