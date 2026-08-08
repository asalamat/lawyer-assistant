import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/apiV1Auth";
import { createMatter, listMatters } from "@/lib/matters";

export async function GET(request: Request) {
  if (!(await requireApiKey(request))) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  return NextResponse.json(await listMatters());
}

export async function POST(request: Request) {
  if (!(await requireApiKey(request))) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof body?.clientName !== "string" || !body.clientName.trim()) {
    return NextResponse.json({ error: "clientName is required" }, { status: 400 });
  }
  if (typeof body?.matterType !== "string" || !body.matterType.trim()) {
    return NextResponse.json({ error: "matterType is required" }, { status: 400 });
  }

  try {
    const matter = await createMatter({
      title: body.title,
      clientName: body.clientName,
      clientEmail: typeof body.clientEmail === "string" ? body.clientEmail : undefined,
      matterType: body.matterType,
      hourlyRate: typeof body.hourlyRate === "number" ? body.hourlyRate : undefined,
    });
    return NextResponse.json(matter, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create matter" },
      { status: 400 },
    );
  }
}
