import { NextResponse } from "next/server";
import { createCampaign, listCampaigns } from "@/lib/campaigns";
import { LEAD_STAGES } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await listCampaigns());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!LEAD_STAGES.includes(body?.triggerStage)) {
    return NextResponse.json({ error: `triggerStage must be one of: ${LEAD_STAGES.join(", ")}` }, { status: 400 });
  }
  if (!Array.isArray(body?.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: "At least one email step is required" }, { status: 400 });
  }

  try {
    const campaign = await createCampaign({
      name: body.name,
      triggerStage: body.triggerStage,
      steps: body.steps.map((step: { delayDays?: number; subject?: string; body?: string }) => ({
        delayDays: typeof step.delayDays === "number" ? step.delayDays : 0,
        subject: typeof step.subject === "string" ? step.subject : "",
        body: typeof step.body === "string" ? step.body : "",
      })),
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create campaign" },
      { status: 400 },
    );
  }
}
