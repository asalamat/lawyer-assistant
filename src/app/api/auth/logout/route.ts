import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  const token = (await cookies()).get("session")?.value;
  await clearSession(token);
  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}
