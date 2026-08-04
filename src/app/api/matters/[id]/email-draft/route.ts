import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { generateEmailDraft } from "@/lib/claude";
import { getMatter, getMatterTextContext } from "@/lib/matters";

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

  const context = await getMatterTextContext(id);
  try {
    const draft = await generateEmailDraft(context, instructions);
    await recordAuditEvent("email_draft_generated", id, "Generated a smart email draft");
    return NextResponse.json(draft);
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
