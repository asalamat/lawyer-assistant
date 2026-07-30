import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  await clearSession();
  const response = NextResponse.json({ success: true });
  response.cookies.delete("session");
  return response;
}
