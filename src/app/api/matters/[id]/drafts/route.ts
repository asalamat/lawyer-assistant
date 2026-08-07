import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { saveAgentRun } from "@/lib/agentRuns";
import { recordAuditEvent } from "@/lib/auditLog";
import { generateDraft } from "@/lib/claude";
import { runDraftingAgent } from "@/lib/draftingAgent";
import { addDraft, getMatter, getMatterDocumentSections, listDrafts } from "@/lib/matters";
import { DRAFT_TYPES, type DraftType } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const drafts = await listDrafts(id);
  return NextResponse.json(drafts);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = await request.json();
  const draftType = body?.draftType as DraftType;
  const instructions = typeof body?.instructions === "string" ? body.instructions : "";
  const agentic = body?.agentic === true;

  if (!DRAFT_TYPES.includes(draftType)) {
    return NextResponse.json(
      { error: `draftType must be one of: ${DRAFT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const sections = await getMatterDocumentSections(id);
  try {
    if (agentic) {
      // The agentic path still gets one plain joined string — it also has
      // a search tool to pull specific passages on demand, so it's less
      // exposed to the same context-overflow problem generateDraft's
      // plain path had (see buildMatterContext); left as-is for now.
      const context = sections.map((s) => `--- ${s.label} ---\n${s.text}`).join("\n\n");
      const result = await runDraftingAgent(id, draftType, instructions, context);
      const draft = await addDraft(id, draftType, result.content);
      const agentRun = await saveAgentRun({
        matterId: id,
        kind: "drafting",
        draftId: draft.id,
        iterations: result.iterations,
        trace: result.trace,
      });
      await recordAuditEvent(
        "draft_agent_run",
        id,
        `Self-checking drafting agent generated a ${draftType} draft after ${result.iterations} self-correction round(s)`,
      );
      return NextResponse.json({ ...draft, agentRun }, { status: 201 });
    }

    const content = await generateDraft(draftType, sections, instructions);
    const draft = await addDraft(id, draftType, content);
    return NextResponse.json(draft, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("too many search steps")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return aiErrorResponse(err);
  }
}
