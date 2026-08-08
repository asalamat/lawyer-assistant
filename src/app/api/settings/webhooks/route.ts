import { NextResponse } from "next/server";
import { createWebhookSubscription, listWebhookSubscriptions } from "@/lib/webhooks";
import { WEBHOOK_EVENT_TYPES } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await listWebhookSubscriptions());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!WEBHOOK_EVENT_TYPES.includes(body?.eventType)) {
    return NextResponse.json(
      { error: `eventType must be one of: ${WEBHOOK_EVENT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (typeof body?.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const subscription = await createWebhookSubscription(body.eventType, body.url);
    return NextResponse.json(subscription, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create webhook" },
      { status: 400 },
    );
  }
}
