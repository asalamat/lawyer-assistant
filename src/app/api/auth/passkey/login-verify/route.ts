import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession, getUserById } from "@/lib/auth";
import { verifyPasskeyAuthentication } from "@/lib/webauthn";

// Public — this IS the login step for the passkey path, equivalent to
// /api/auth/login for password login. No rate limiting here the way
// password login has: a passkey attempt requires physically interacting
// with a real registered authenticator, not something brute-forceable by
// guessing, so the same lockout logic doesn't apply.
export async function POST(request: Request) {
  const challenge = (await cookies()).get("webauthn_challenge")?.value;
  if (!challenge) {
    return NextResponse.json({ error: "This sign-in attempt expired. Try again." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.response) {
    return NextResponse.json({ error: "Missing passkey response" }, { status: 400 });
  }

  try {
    const origin = new URL(request.url).origin;
    const { userId } = await verifyPasskeyAuthentication(body.response, challenge, origin);
    const user = await getUserById(userId);
    if (!user || !user.active) {
      return NextResponse.json({ error: "This account is no longer active." }, { status: 403 });
    }

    const token = await createSession(user.id);
    const response = NextResponse.json({ success: true });
    response.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.delete("webauthn_challenge");
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Passkey sign-in failed" },
      { status: 400 },
    );
  }
}
