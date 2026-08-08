import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  extractTemplateFields,
  generateFromTemplate,
  listAssembledDocuments,
  listDocumentTemplates,
} from "@/lib/documentTemplates";
import { getMatter } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [documents, templates] = await Promise.all([listAssembledDocuments(id), listDocumentTemplates()]);
  const templatesWithFields = templates.map((template) => ({
    ...template,
    fields: extractTemplateFields(template.content),
  }));
  return NextResponse.json({ documents, templates: templatesWithFields });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const user = await getCurrentUser();
  const body = await request.json().catch(() => null);
  const templateId = body?.templateId;
  const fields = body?.fields;
  if (typeof templateId !== "string" || !templateId) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }
  if (fields !== undefined && (typeof fields !== "object" || fields === null || Array.isArray(fields))) {
    return NextResponse.json({ error: "fields must be an object" }, { status: 400 });
  }

  try {
    const document = await generateFromTemplate(templateId, id, fields ?? {}, user?.name ?? null);
    return NextResponse.json(document, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate document" },
      { status: 400 },
    );
  }
}
