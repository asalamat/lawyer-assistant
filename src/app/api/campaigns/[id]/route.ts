import { NextResponse } from "next/server";
import { deleteCampaign } from "@/lib/campaigns";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteCampaign(id);
  return NextResponse.json({ success: true });
}
