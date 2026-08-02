import { NextResponse } from "next/server";
import { saveEmailAccount } from "@/lib/emailIntegration";
import { testYahooImapLogin } from "@/lib/yahooImap";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const emailAddress = body?.emailAddress;
  const appPassword = body?.appPassword;

  if (typeof emailAddress !== "string" || !emailAddress.includes("@")) {
    return NextResponse.json({ error: "A valid Yahoo email address is required" }, { status: 400 });
  }
  if (typeof appPassword !== "string" || !appPassword.trim()) {
    return NextResponse.json({ error: "App password is required" }, { status: 400 });
  }

  try {
    await testYahooImapLogin(emailAddress, appPassword);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not sign in to Yahoo Mail";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const account = await saveEmailAccount({
    provider: "yahoo",
    emailAddress,
    accessToken: appPassword,
    refreshToken: null,
    tokenExpiresAt: null,
  });

  return NextResponse.json(account, { status: 201 });
}
