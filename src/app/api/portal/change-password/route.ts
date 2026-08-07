import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { changeClientPassword, getClientSessionUser } from "@/lib/clientAuth";
import { checkLoginRateLimit, recordFailedLogin, recordSuccessfulLogin } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const token = (await cookies()).get("client_session")?.value;
  const user = await getClientSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = checkLoginRateLimit(user.email);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${rateLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const body = await request.json();
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return NextResponse.json(
      { error: "currentPassword and newPassword are required" },
      { status: 400 },
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const changed = await changeClientPassword(user.id, currentPassword, newPassword);
  if (!changed) {
    recordFailedLogin(user.email);
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  recordSuccessfulLogin(user.email);
  return NextResponse.json({ success: true });
}
