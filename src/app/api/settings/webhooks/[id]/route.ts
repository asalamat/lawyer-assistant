import { NextResponse } from "next/server";
import { deleteWebhookSubscription } from "@/lib/webhooks";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteWebhookSubscription(id);
  return NextResponse.json({ success: true });
}
