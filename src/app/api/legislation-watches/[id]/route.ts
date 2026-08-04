import { NextResponse } from "next/server";
import { deleteLegislationWatch } from "@/lib/legislationWatch";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteLegislationWatch(id);
  return NextResponse.json({ ok: true });
}
