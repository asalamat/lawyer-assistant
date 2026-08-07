import { NextResponse } from "next/server";
import { removeTeamMember } from "@/lib/matterTeam";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const removed = await removeTeamMember(id, userId);
  if (!removed) {
    return NextResponse.json({ error: "That person isn't on this matter's team" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
