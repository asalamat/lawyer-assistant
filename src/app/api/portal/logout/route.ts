import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearClientSession } from "@/lib/clientAuth";

export async function POST() {
  const token = (await cookies()).get("client_session")?.value;
  await clearClientSession(token);
  const response = NextResponse.json({ success: true });
  response.cookies.delete("client_session");
  return response;
}
