import { NextResponse } from "next/server";
import { deleteDeadlineRule } from "@/lib/deadlineRules";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteDeadlineRule(id);
  return NextResponse.json({ success: true });
}
