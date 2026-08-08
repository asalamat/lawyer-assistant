import { randomUUID } from "crypto";
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import { recordAuditEvent } from "./auditLog";
import { getClient } from "./clients";
import db, { toPlain } from "./db";
import { getMatter } from "./matters";
import type { AssembledDocument, DocumentTemplate } from "./types";

const FIELD_PATTERN = /\{\{(\w[\w.]*)\}\}/g;

// Fields the merge can fill automatically from matter/client data — anything
// else found in a template's {{...}} placeholders is a custom field the
// person generating it has to type in themselves. No separate field-schema
// table per template; the placeholders in the content ARE the schema.
const AUTO_FILL_FIELDS = new Set([
  "matter.title",
  "matter.fileNumber",
  "matter.matterType",
  "matter.clientName",
  "client.email",
  "client.phone",
  "today",
  "lawyerName",
]);

export async function listDocumentTemplates(): Promise<DocumentTemplate[]> {
  return db
    .prepare("SELECT * FROM document_templates ORDER BY name ASC")
    .all()
    .map((row) => toPlain<DocumentTemplate>(row));
}

export async function getDocumentTemplate(id: string): Promise<DocumentTemplate | null> {
  const row = db.prepare("SELECT * FROM document_templates WHERE id = ?").get(id);
  return row ? toPlain<DocumentTemplate>(row) : null;
}

export async function createDocumentTemplate(input: {
  name: string;
  description?: string | null;
  content: string;
  createdByUserId: string | null;
}): Promise<DocumentTemplate> {
  const name = input.name.trim();
  if (!name) throw new Error("Template name is required");
  if (!input.content.trim()) throw new Error("Template content can't be empty");

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO document_templates (id, name, description, content, createdAt, createdByUserId) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, name, input.description ?? null, input.content, createdAt, input.createdByUserId);
  return { id, name, description: input.description ?? null, content: input.content, createdAt, createdByUserId: input.createdByUserId };
}

export async function deleteDocumentTemplate(id: string): Promise<void> {
  db.prepare("DELETE FROM document_templates WHERE id = ?").run(id);
}

// Every distinct {{field}} in the template, in first-appearance order,
// split into what the merge can fill on its own vs. what needs a person to
// type a value in.
export function extractTemplateFields(content: string): { autoFill: string[]; custom: string[] } {
  const seen = new Set<string>();
  const autoFill: string[] = [];
  const custom: string[] = [];
  for (const match of content.matchAll(FIELD_PATTERN)) {
    const field = match[1];
    if (seen.has(field)) continue;
    seen.add(field);
    (AUTO_FILL_FIELDS.has(field) ? autoFill : custom).push(field);
  }
  return { autoFill, custom };
}

async function resolveAutoFillValues(
  matterId: string,
  lawyerName: string | null,
): Promise<Record<string, string>> {
  const matter = await getMatter(matterId);
  const client = matter?.clientId ? await getClient(matter.clientId) : null;
  return {
    "matter.title": matter?.title ?? "",
    "matter.fileNumber": matter?.fileNumber ?? "",
    "matter.matterType": matter?.matterType ?? "",
    "matter.clientName": matter?.clientName ?? "",
    "client.email": client?.email ?? matter?.clientEmail ?? "",
    "client.phone": client?.phone ?? "",
    today: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    lawyerName: lawyerName ?? "",
  };
}

export async function listAssembledDocuments(matterId: string): Promise<AssembledDocument[]> {
  return db
    .prepare("SELECT * FROM assembled_documents WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<AssembledDocument>(row));
}

export async function getAssembledDocument(matterId: string, id: string): Promise<AssembledDocument | null> {
  const row = db.prepare("SELECT * FROM assembled_documents WHERE id = ? AND matterId = ?").get(id, matterId);
  return row ? toPlain<AssembledDocument>(row) : null;
}

export async function generateFromTemplate(
  templateId: string,
  matterId: string,
  customFieldValues: Record<string, string>,
  lawyerName: string | null,
): Promise<AssembledDocument> {
  const template = await getDocumentTemplate(templateId);
  if (!template) throw new Error("Template not found");

  const autoFillValues = await resolveAutoFillValues(matterId, lawyerName);
  const content = template.content.replace(FIELD_PATTERN, (_match, field: string) => {
    if (field in autoFillValues) return autoFillValues[field];
    if (field in customFieldValues) return customFieldValues[field];
    return `{{${field}}}`;
  });

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO assembled_documents (id, matterId, templateId, content, createdAt) VALUES (?, ?, ?, ?, ?)",
  ).run(id, matterId, templateId, content, createdAt);

  await recordAuditEvent(
    "document_assembled",
    matterId,
    `Generated "${template.name}" from a document template`,
  );

  return { id, matterId, templateId, content, createdAt };
}

// Short, no trailing punctuation — a reasonable heuristic for "this is a
// title, not a sentence." Deliberately applied only to the first non-empty
// line, not every line that happens to be short — a formal letter is full
// of short lines further down ("Matter: ...", "Date: ...", "Sincerely,")
// that would otherwise get misdetected as headings too.
function looksLikeHeading(line: string): boolean {
  return line.length > 0 && line.length <= 70 && !/[.,;:]$/.test(line);
}

// A simple, cleanly-formatted .docx over the same merged content already
// produced by generateFromTemplate() — an export format alongside the
// existing PDF export, not a new authoring flow. Templates stay plain text
// with {{field}} placeholders; this just also renders as a real Word file.
export async function generateDocxBuffer(assembled: AssembledDocument): Promise<Buffer> {
  let titleAssigned = false;
  const paragraphs = assembled.content.split("\n").map((rawLine) => {
    const line = rawLine.trim();
    if (!line) return new Paragraph({ text: "" });
    if (!titleAssigned && looksLikeHeading(line)) {
      titleAssigned = true;
      return new Paragraph({ text: line, heading: HeadingLevel.HEADING_2 });
    }
    titleAssigned = true;
    return new Paragraph({ text: line });
  });

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
