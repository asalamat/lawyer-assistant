import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { answerWizard, getWizardState } from "@/lib/rcloneWizard";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.value !== "string") {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  answerWizard(body.value);
  return NextResponse.json(getWizardState());
}
