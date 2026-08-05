import { NextResponse } from "next/server";
import { getAgentRunForDraft } from "@/lib/agentRuns";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await params;
  const agentRun = await getAgentRunForDraft(draftId);
  if (!agentRun) {
    return NextResponse.json({ error: "No agent run recorded for this draft" }, { status: 404 });
  }
  return NextResponse.json(agentRun);
}
