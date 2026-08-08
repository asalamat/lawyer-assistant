import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createFeatureRequest, listFeatureRequests } from "@/lib/featureRequests";

export async function GET() {
  return NextResponse.json(await listFeatureRequests());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "A title is required" }, { status: 400 });
  }

  const featureRequest = await createFeatureRequest({
    userId: user.id,
    userName: user.name,
    title,
    description: typeof body?.description === "string" ? body.description.trim() || null : null,
  });
  return NextResponse.json(featureRequest, { status: 201 });
}
