import { NextResponse } from "next/server";
import { createMatter, listMatters } from "@/lib/matters";

export async function GET() {
  const matters = await listMatters();
  return NextResponse.json(matters);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title, clientName, matterType } = body ?? {};

  if (!title || !clientName || !matterType) {
    return NextResponse.json(
      { error: "title, clientName, and matterType are required" },
      { status: 400 },
    );
  }

  const matter = await createMatter({ title, clientName, matterType });
  return NextResponse.json(matter, { status: 201 });
}
