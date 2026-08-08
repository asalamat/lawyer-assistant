import { NextResponse } from "next/server";
import { deleteHoliday } from "@/lib/deadlineRules";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteHoliday(id);
  return NextResponse.json({ success: true });
}
