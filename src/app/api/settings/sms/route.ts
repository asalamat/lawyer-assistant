import { NextResponse } from "next/server";
import { getTwilioStatus, setTwilioConfig } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getTwilioStatus());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { accountSid, authToken, fromPhoneNumber } = body ?? {};

  if (typeof accountSid !== "string" || !accountSid.trim()) {
    return NextResponse.json({ error: "accountSid is required" }, { status: 400 });
  }
  if (typeof authToken !== "string" || !authToken) {
    return NextResponse.json({ error: "authToken is required" }, { status: 400 });
  }
  if (typeof fromPhoneNumber !== "string" || !fromPhoneNumber.trim()) {
    return NextResponse.json({ error: "fromPhoneNumber is required" }, { status: 400 });
  }

  await setTwilioConfig({
    accountSid: accountSid.trim(),
    authToken,
    fromPhoneNumber: fromPhoneNumber.trim(),
  });

  return NextResponse.json(await getTwilioStatus());
}
