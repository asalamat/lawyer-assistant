import { NextResponse } from "next/server";
import { getPiiMaskingSettings, setPiiMaskingSettings } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getPiiMaskingSettings());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const fields = ["enabled", "sin", "ssn", "creditCard", "phone", "email"] as const;
  const partial: Partial<Record<(typeof fields)[number], boolean>> = {};
  for (const field of fields) {
    if (field in body) {
      if (typeof body[field] !== "boolean") {
        return NextResponse.json({ error: `${field} must be a boolean` }, { status: 400 });
      }
      partial[field] = body[field];
    }
  }

  const updated = await setPiiMaskingSettings(partial);
  return NextResponse.json(updated);
}
