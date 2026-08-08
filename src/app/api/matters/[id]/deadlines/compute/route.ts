import { NextResponse } from "next/server";
import { applyDeadlineRule } from "@/lib/deadlineRules";
import { getMatter } from "@/lib/matters";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const ruleId = body?.ruleId;
  const triggerDate = body?.triggerDate;

  if (typeof ruleId !== "string" || !ruleId) {
    return NextResponse.json({ error: "ruleId is required" }, { status: 400 });
  }
  if (typeof triggerDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(triggerDate)) {
    return NextResponse.json({ error: "triggerDate must be in YYYY-MM-DD format" }, { status: 400 });
  }

  try {
    const deadline = await applyDeadlineRule(id, ruleId, triggerDate);
    return NextResponse.json(deadline, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute deadline" },
      { status: 400 },
    );
  }
}
