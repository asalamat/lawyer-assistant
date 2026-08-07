import { NextResponse } from "next/server";
import { consumePendingMfaToken, createSession, verifyTotpOrBackupCode } from "@/lib/auth";

// The pendingToken is single-use — issued once a password already checked
// out (see /api/auth/login), consumed here whether or not the code turns
// out to be correct. A wrong code means starting the login over, which is a
// deliberate simplicity/security tradeoff: it avoids needing a second,
// separate attempt counter just for this step, since each pendingToken is
// already gated behind a correct password.
export async function POST(request: Request) {
  const body = await request.json();
  const pendingToken = body?.pendingToken;
  const code = body?.code;
  if (typeof pendingToken !== "string" || typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "pendingToken and code are required" }, { status: 400 });
  }

  const userId = await consumePendingMfaToken(pendingToken);
  if (!userId) {
    return NextResponse.json(
      { error: "This login attempt has expired. Please log in again." },
      { status: 401 },
    );
  }

  const valid = await verifyTotpOrBackupCode(userId, code);
  if (!valid) {
    return NextResponse.json(
      { error: "Incorrect code. Please log in again." },
      { status: 401 },
    );
  }

  const token = await createSession(userId);
  const response = NextResponse.json({ success: true });
  response.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
