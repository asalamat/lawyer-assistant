import { NextResponse } from "next/server";
import { setCalendarSyncEnabled } from "@/lib/emailIntegration";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
  }

  try {
    await setCalendarSyncEnabled(provider as EmailProvider, body.enabled);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update calendar sync" },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true });
}
