import { NextResponse } from "next/server";
import { getMatter, updateMatterStatus } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }
  return NextResponse.json(matter);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const status = body?.status;

  if (status !== "open" && status !== "closed") {
    return NextResponse.json({ error: "status must be 'open' or 'closed'" }, { status: 400 });
  }

  const matter = await updateMatterStatus(id, status);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }
  return NextResponse.json(matter);
}
