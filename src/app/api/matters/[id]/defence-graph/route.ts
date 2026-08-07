import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { recordAuditEvent } from "@/lib/auditLog";
import { extractDefenceGraph } from "@/lib/claude";
import { getMatter, listDrafts } from "@/lib/matters";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const drafts = (await listDrafts(id)).filter((d) => d.draftType === "Defence strategy memo");
  const memo = body?.draftId ? drafts.find((d) => d.id === body.draftId) : drafts[0];
  if (!memo) {
    return NextResponse.json(
      { error: "No defence strategy memo to visualize yet — generate one first." },
      { status: 400 },
    );
  }

  try {
    const graph = await extractDefenceGraph(memo.content);
    await recordAuditEvent("defence_graph_generated", id, "Generated a defence graph visualization");
    return NextResponse.json(graph);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
