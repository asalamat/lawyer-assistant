import { NextResponse } from "next/server";
import { createHoliday, listHolidays } from "@/lib/deadlineRules";

export async function GET() {
  return NextResponse.json(await listHolidays());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: "date must be in YYYY-MM-DD format" }, { status: 400 });
  }

  try {
    const holiday = await createHoliday({
      name: body.name,
      date: body.date,
      recurringYearly: body?.recurringYearly !== false,
    });
    return NextResponse.json(holiday, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create holiday" },
      { status: 400 },
    );
  }
}
