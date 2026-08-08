import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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
  const { workedOn, description, hours, rate } = body ?? {};

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
  let parsedRate: number | null = null;
  if (rate !== undefined && rate !== null && rate !== "") {
    parsedRate = Number(rate);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      return NextResponse.json({ error: "rate must be a positive number" }, { status: 400 });
    }
  }

  const user = await getCurrentUser();
  const entry = await addTimeEntry(id, {
    workedOn,
    description: description.trim(),
    hours: parsedHours,
    rate: parsedRate,
    userId: user?.id ?? null,
  });
  return NextResponse.json(entry, { status: 201 });
}
