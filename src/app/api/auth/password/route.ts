import { NextResponse } from "next/server";
import { setPassword, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
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

  const valid = await verifyPassword(currentPassword);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  await setPassword(newPassword);
  return NextResponse.json({ success: true });
}
