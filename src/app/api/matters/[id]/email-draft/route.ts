import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { recordAuditEvent } from "@/lib/auditLog";
import { generateEmailDraft } from "@/lib/claude";
import { getMatter, getMatterDocumentSections } from "@/lib/matters";

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
  const instructions = typeof body?.instructions === "string" ? body.instructions : "";

  const sections = await getMatterDocumentSections(id);
  try {
    const draft = await generateEmailDraft(sections, instructions);
    await recordAuditEvent("email_draft_generated", id, "Generated a smart email draft");
    return NextResponse.json(draft);
  } catch (err) {
    return aiErrorResponse(err);
  }
}
