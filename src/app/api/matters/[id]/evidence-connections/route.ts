import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { recordAuditEvent } from "@/lib/auditLog";
import { extractEvidenceConnections } from "@/lib/claude";
import { getMatter, getMatterDocumentSections } from "@/lib/matters";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const sections = await getMatterDocumentSections(id);
  if (sections.length === 0) {
    return NextResponse.json(
      { error: "No documents to analyze yet — upload documents first." },
      { status: 400 },
    );
  }

  try {
    const graph = await extractEvidenceConnections(sections);
    await recordAuditEvent("evidence_connections_generated", id, "Generated an evidence-connections graph");
    return NextResponse.json(graph);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
