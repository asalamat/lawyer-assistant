import { NextResponse } from "next/server";
import { getDocuSignStatus, setDocuSignConfig } from "@/lib/settings";

export async function GET() {
  const status = await getDocuSignStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { integrationKey, userId, accountId, privateKey, demo, enabled } = body ?? {};

  if (typeof integrationKey !== "string" || !integrationKey.trim()) {
    return NextResponse.json({ error: "integrationKey is required" }, { status: 400 });
  }
  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (typeof accountId !== "string" || !accountId.trim()) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }
  if (typeof privateKey !== "string" || !privateKey.includes("PRIVATE KEY")) {
    return NextResponse.json({ error: "privateKey must be a PEM-formatted RSA private key" }, { status: 400 });
  }

  await setDocuSignConfig({
    integrationKey: integrationKey.trim(),
    userId: userId.trim(),
    accountId: accountId.trim(),
    privateKey: privateKey.trim(),
    demo: demo !== false,
    enabled: Boolean(enabled),
  });

  const status = await getDocuSignStatus();
  return NextResponse.json(status);
}
