import { NextResponse } from "next/server";
import { createMatter, listMatters } from "@/lib/matters";

export async function GET() {
  const matters = await listMatters();
  return NextResponse.json(matters);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title, clientName, clientEmail, matterType } = body ?? {};

  if (!title || !clientName || !matterType) {
    return NextResponse.json(
      { error: "title, clientName, and matterType are required" },
      { status: 400 },
    );
  }
  if (clientEmail && (typeof clientEmail !== "string" || !clientEmail.includes("@"))) {
    return NextResponse.json({ error: "clientEmail must be a valid email address" }, { status: 400 });
  }

  const matter = await createMatter({ title, clientName, clientEmail, matterType });
  return NextResponse.json(matter, { status: 201 });
}
