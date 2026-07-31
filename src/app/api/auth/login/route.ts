import { NextResponse } from "next/server";
import { createSession, isPasswordSet, setPassword, verifyPassword } from "@/lib/auth";
import { checkLoginRateLimit, recordFailedLogin, recordSuccessfulLogin } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const rateLimit = checkLoginRateLimit();
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${rateLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const body = await request.json();
  const password = body?.password;
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "password is required" }, { status: 400 });
  }

  const alreadySet = await isPasswordSet();
  if (!alreadySet) {
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }
    await setPassword(password);
  } else {
    const valid = await verifyPassword(password);
    if (!valid) {
      recordFailedLogin();
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
  }

  recordSuccessfulLogin();
  const token = await createSession();
  const response = NextResponse.json({ success: true });
  response.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
