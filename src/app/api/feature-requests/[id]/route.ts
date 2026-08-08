import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteFeatureRequest, updateFeatureRequestStatus } from "@/lib/featureRequests";
import { FEATURE_REQUEST_STATUSES } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!FEATURE_REQUEST_STATUSES.includes(body?.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${FEATURE_REQUEST_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const updated = await updateFeatureRequestStatus(id, body.status);
  if (!updated) return NextResponse.json({ error: "Wish item not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const { id } = await params;
  await deleteFeatureRequest(id);
  return NextResponse.json({ success: true });
}
