import { NextResponse } from "next/server";
import { saveEmailAccount } from "@/lib/emailIntegration";
import { testImapLogin } from "@/lib/imapMail";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  const typedProvider = provider as EmailProvider;

  const body = await request.json().catch(() => null);
  const emailAddress = body?.emailAddress;
  const appPassword = body?.appPassword;

  if (typeof emailAddress !== "string" || !emailAddress.includes("@")) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  if (typeof appPassword !== "string" || !appPassword.trim()) {
    return NextResponse.json({ error: "App password is required" }, { status: 400 });
  }

  try {
    await testImapLogin(typedProvider, emailAddress, appPassword);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sign in";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const account = await saveEmailAccount({
    provider: typedProvider,
    emailAddress,
    accessToken: appPassword,
    refreshToken: null,
    tokenExpiresAt: null,
    authMethod: "app_password",
  });

  return NextResponse.json(account, { status: 201 });
}
