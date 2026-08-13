import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { verifyPasskeyRegistration } from "@/lib/webauthn";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const challenge = (await cookies()).get("webauthn_challenge")?.value;
  if (!challenge) {
    return NextResponse.json({ error: "This registration attempt expired. Try again." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.response) {
    return NextResponse.json({ error: "Missing passkey response" }, { status: 400 });
  }
  const label = typeof body?.label === "string" ? body.label : "Passkey";

  try {
    const origin = new URL(request.url).origin;
    await verifyPasskeyRegistration(user.id, body.response, challenge, origin, label);
    const response = NextResponse.json({ ok: true });
    response.cookies.delete("webauthn_challenge");
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to register passkey" },
      { status: 400 },
    );
  }
}
