import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generatePasskeyRegistrationOptions } from "@/lib/webauthn";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origin = new URL(request.url).origin;
  const options = await generatePasskeyRegistrationOptions(user, origin);

  const response = NextResponse.json(options);
  // Short-lived and httpOnly — this is the one piece of state that has to
  // survive between "generate options" and "verify" without a database
  // round trip; the real credential secret never touches this cookie.
  response.cookies.set("webauthn_challenge", options.challenge, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return response;
}
