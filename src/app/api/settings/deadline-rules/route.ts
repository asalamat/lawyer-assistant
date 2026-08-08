import { NextResponse } from "next/server";
import { createDeadlineRule, listDeadlineRules } from "@/lib/deadlineRules";
import { DEADLINE_DIRECTIONS, DEADLINE_OFFSET_UNITS } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await listDeadlineRules());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = body?.name;
  const offsetDays = Number(body?.offsetDays);
  const offsetUnit = body?.offsetUnit;
  const direction = body?.direction;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!Number.isFinite(offsetDays) || offsetDays < 0) {
    return NextResponse.json({ error: "offsetDays must be zero or a positive number" }, { status: 400 });
  }
  if (!DEADLINE_OFFSET_UNITS.includes(offsetUnit)) {
    return NextResponse.json({ error: `offsetUnit must be one of: ${DEADLINE_OFFSET_UNITS.join(", ")}` }, { status: 400 });
  }
  if (!DEADLINE_DIRECTIONS.includes(direction)) {
    return NextResponse.json({ error: `direction must be one of: ${DEADLINE_DIRECTIONS.join(", ")}` }, { status: 400 });
  }

  try {
    const rule = await createDeadlineRule({
      name,
      description: typeof body?.description === "string" ? body.description : null,
      offsetDays,
      offsetUnit,
      direction,
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create rule" },
      { status: 400 },
    );
  }
}
