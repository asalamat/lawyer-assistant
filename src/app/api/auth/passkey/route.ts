import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listCredentials } from "@/lib/webauthn";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listCredentials(user.id));
}
