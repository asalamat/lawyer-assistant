import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { extractEvidenceGraph } from "@/lib/claude";
import { getMatter, listEvidenceMatrices } from "@/lib/matters";

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
  const matrices = await listEvidenceMatrices(id);
  const matrix = body?.matrixId
    ? matrices.find((m) => m.id === body.matrixId)
    : matrices[0];
  if (!matrix) {
    return NextResponse.json(
      { error: "No evidence matrix to visualize yet — generate one first." },
      { status: 400 },
    );
  }

  try {
    const graph = await extractEvidenceGraph(matrix.content);
    await recordAuditEvent("evidence_graph_generated", id, "Generated an evidence graph visualization");
    return NextResponse.json(graph);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error: ${err.message}` },
        { status: err.status ?? 502 },
      );
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
