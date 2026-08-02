import { NextResponse } from "next/server";
import { listRecentMessages } from "@/lib/emailRead";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  try {
    const messages = await listRecentMessages(provider as EmailProvider);
    return NextResponse.json(messages);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list messages";
    const clientError =
      message.includes("is connected") || message.includes("not supported");
    return NextResponse.json({ error: message }, { status: clientError ? 400 : 502 });
  }
}
