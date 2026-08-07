import { NextResponse } from "next/server";
import { checkLoginRateLimit, recordFailedLogin, recordSuccessfulLogin } from "@/lib/rateLimit";
import { createClientSession, verifyClientLogin } from "@/lib/clientAuth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
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

  const user = await verifyClientLogin(email, password);
  if (!user) {
    recordFailedLogin(email);
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  recordSuccessfulLogin(email);
  const token = await createClientSession(user.id);
  const response = NextResponse.json({ success: true, mustChangePassword: Boolean(user.mustChangePassword) });
  response.cookies.set("client_session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
