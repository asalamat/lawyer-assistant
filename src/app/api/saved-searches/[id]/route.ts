import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteSavedSearch } from "@/lib/savedSearches";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteSavedSearch(user.id, id);
  return NextResponse.json({ success: true });
}
