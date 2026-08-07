import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { filterAccessibleMatterIds } from "@/lib/matterAccess";
import { searchMattersForLinking } from "@/lib/relatedMatters";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const exclude = searchParams.get("exclude") ?? "";
  const results = await searchMattersForLinking(query, exclude);

  const user = await getCurrentUser();
  if (!user) return NextResponse.json(results);
  const accessibleIds = filterAccessibleMatterIds(user.id, user.role, results.map((m) => m.id));
  return NextResponse.json(results.filter((m) => accessibleIds.has(m.id)));
}
