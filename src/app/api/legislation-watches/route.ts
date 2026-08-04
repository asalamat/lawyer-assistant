import { NextResponse } from "next/server";
import { addLegislationWatch, listLegislationWatches } from "@/lib/legislationWatch";

export async function GET() {
  const watches = await listLegislationWatches();
  return NextResponse.json(watches);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { databaseId, legislationId, label } = body ?? {};

  if (typeof databaseId !== "string" || !databaseId.trim()) {
    return NextResponse.json({ error: "databaseId is required" }, { status: 400 });
  }
  if (typeof legislationId !== "string" || !legislationId.trim()) {
    return NextResponse.json({ error: "legislationId is required" }, { status: 400 });
  }
  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const watch = await addLegislationWatch({
    databaseId: databaseId.trim(),
    legislationId: legislationId.trim(),
    label: label.trim(),
  });
  return NextResponse.json(watch, { status: 201 });
}
