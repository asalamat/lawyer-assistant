import { NextResponse } from "next/server";
import { createApiKey, listApiKeys } from "@/lib/apiKeys";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  return NextResponse.json(await listApiKeys());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => null);
  if (typeof body?.label !== "string" || !body.label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  try {
    const { apiKey, key } = await createApiKey(body.label, user?.id ?? null);
    return NextResponse.json({ ...apiKey, key }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create API key" },
      { status: 400 },
    );
  }
}
