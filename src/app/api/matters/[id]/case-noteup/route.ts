import { NextResponse } from "next/server";
import { listCaseNoteups, refreshCaseNoteups } from "@/lib/caseNoteup";
import { getMatter } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const noteups = await listCaseNoteups(id);
  return NextResponse.json(noteups);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  try {
    const noteups = await refreshCaseNoteups(id);
    return NextResponse.json(noteups, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Case note-up failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
