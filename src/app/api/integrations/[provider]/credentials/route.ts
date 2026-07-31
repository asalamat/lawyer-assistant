import { NextResponse } from "next/server";
import { setOAuthCredentials } from "@/lib/emailIntegration";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const body = await request.json();
  const clientId = body?.clientId;
  const clientSecret = body?.clientSecret;
  if (typeof clientId !== "string" || !clientId.trim() || typeof clientSecret !== "string" || !clientSecret.trim()) {
    return NextResponse.json(
      { error: "clientId and clientSecret are required" },
      { status: 400 },
    );
  }

  await setOAuthCredentials(provider as EmailProvider, clientId.trim(), clientSecret.trim());
  return NextResponse.json({ success: true });
}
