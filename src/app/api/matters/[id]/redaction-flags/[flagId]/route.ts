import { NextResponse } from "next/server";
import { updateRedactionFlagStatus } from "@/lib/matters";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; flagId: string }> },
) {
  const { id, flagId } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.status !== "cleared" && body.status !== "confirmed") {
    return NextResponse.json({ error: "status must be 'cleared' or 'confirmed'" }, { status: 400 });
  }

  const flag = await updateRedactionFlagStatus(id, flagId, body.status);
  if (!flag) {
    return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  }
  return NextResponse.json(flag);
}
