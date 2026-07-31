import { NextResponse } from "next/server";
import { addTimeEntry, listTimeEntries } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const entries = await listTimeEntries(id);
  return NextResponse.json(entries);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { workedOn, description, hours } = body ?? {};

  if (typeof workedOn !== "string" || !workedOn.trim()) {
    return NextResponse.json({ error: "workedOn date is required" }, { status: 400 });
  }
  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  const parsedHours = Number(hours);
  if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
    return NextResponse.json({ error: "hours must be a positive number" }, { status: 400 });
  }

  const entry = await addTimeEntry(id, {
    workedOn,
    description: description.trim(),
    hours: parsedHours,
  });
  return NextResponse.json(entry, { status: 201 });
}
