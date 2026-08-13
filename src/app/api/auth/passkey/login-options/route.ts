import { NextResponse } from "next/server";
import { generatePasskeyAuthenticationOptions } from "@/lib/webauthn";

// Public — reached from the login page before any session exists. No user
// is identified here at all; the browser's passkey picker (discoverable
// credentials) is what narrows it down, and login-verify below resolves
// which user owns whichever passkey was actually used.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const options = await generatePasskeyAuthenticationOptions(origin);

  const response = NextResponse.json(options);
  response.cookies.set("webauthn_challenge", options.challenge, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  return response;
}
