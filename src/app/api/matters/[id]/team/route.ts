import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMatter } from "@/lib/matters";
import { addTeamMember, listTeam } from "@/lib/matterTeam";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await listTeam(id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const roleOnMatter = body?.roleOnMatter;

  if (typeof userId !== "string" || !userId.trim()) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (typeof roleOnMatter !== "string" || !roleOnMatter.trim()) {
    return NextResponse.json({ error: "roleOnMatter is required" }, { status: 400 });
  }

  const currentUser = await getCurrentUser();
  try {
    const member = await addTeamMember(id, userId, roleOnMatter, currentUser?.id ?? null);
    return NextResponse.json(member);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add team member" },
      { status: 400 },
    );
  }
}
