import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/apiKeys";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await revokeApiKey(id);
  return NextResponse.json({ success: true });
}
