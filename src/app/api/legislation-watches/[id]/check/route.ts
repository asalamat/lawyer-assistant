import { NextResponse } from "next/server";
import { checkLegislationWatch } from "@/lib/legislationWatch";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const result = await checkLegislationWatch(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Check failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
