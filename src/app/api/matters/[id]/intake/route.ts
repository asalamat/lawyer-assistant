import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createAndSendIntake, listIntakeResponses } from "@/lib/intake";
import { getMatter } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listIntakeResponses(id));
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const user = await getCurrentUser();
  try {
    const { id: responseId, token } = await createAndSendIntake(id, user?.id ?? null);
    return NextResponse.json({ id: responseId, link: `/intake/${token}` }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send intake questionnaire" },
      { status: 400 },
    );
  }
}
