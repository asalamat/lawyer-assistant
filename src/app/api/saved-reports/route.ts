import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSavedReport, listSavedReports } from "@/lib/savedReports";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listSavedReports(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const label = body?.label;
  const query = body?.query;

  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }
  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const savedReport = await createSavedReport(user.id, label.trim(), query.trim());
  return NextResponse.json(savedReport, { status: 201 });
}
