import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { approveReferenceDocument } from "@/lib/referenceLibrary";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "staff") {
    return NextResponse.json({ error: "Only a lawyer or admin can approve reference documents" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await approveReferenceDocument(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to approve reference document" },
      { status: 400 },
    );
  }
}
