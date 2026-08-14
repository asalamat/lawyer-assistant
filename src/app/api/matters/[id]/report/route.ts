import { NextResponse } from "next/server";
import { buildMatterReport } from "@/lib/matterReport";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const report = await buildMatterReport(id);
  if (!report) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }
  return NextResponse.json(report);
}
