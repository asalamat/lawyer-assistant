import { NextResponse } from "next/server";
import {
  bootstrapFirstAdmin,
  createPendingMfaToken,
  createSession,
  hasAnyUsers,
  isTotpEnabled,
  verifyLogin,
} from "@/lib/auth";
import { checkLoginRateLimit, recordFailedLogin, recordSuccessfulLogin } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const body = await request.json();
  const email = body?.email;
  const password = body?.password;
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  const rateLimit = checkLoginRateLimit(email);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${rateLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const bootstrapping = !(await hasAnyUsers());
  let userId: string;

  if (bootstrapping) {
    const name = body?.name;
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const user = await bootstrapFirstAdmin({ email, name, password });
    userId = user.id;
  } else {
    const user = await verifyLogin(email, password);
    if (!user) {
      recordFailedLogin(email);
      return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
    }
    // Password is correct at this point, but a session isn't created yet if
    // MFA is enabled — the client has to complete /api/auth/mfa first.
    if (await isTotpEnabled(user.id)) {
      recordSuccessfulLogin(email);
      const pendingToken = await createPendingMfaToken(user.id);
      return NextResponse.json({ mfaRequired: true, pendingToken });
    }
    userId = user.id;
  }

  recordSuccessfulLogin(email);
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
