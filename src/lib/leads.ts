import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import { createMatter } from "./matters";
import type { Lead, LeadStage, Matter } from "./types";
import { fireWebhook } from "./webhooks";

export async function listLeads(): Promise<Lead[]> {
  return db
    .prepare("SELECT * FROM leads ORDER BY createdAt DESC")
    .all()
    .map((row) => toPlain<Lead>(row));
}

export async function getLead(id: string): Promise<Lead | null> {
  const row = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  return row ? toPlain<Lead>(row) : null;
}

export async function createLead(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  notes?: string | null;
  assignedToUserId?: string | null;
}): Promise<Lead> {
  const name = input.name.trim();
  if (!name) throw new Error("Lead name is required");

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO leads (id, name, email, phone, source, stage, notes, assignedToUserId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`,
  ).run(id, name, input.email ?? null, input.phone ?? null, input.source ?? null, input.notes ?? null, input.assignedToUserId ?? null, now, now);

  await recordAuditEvent("lead_created", null, `Added lead "${name}"`);

  const lead: Lead = {
    id,
    name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    source: input.source ?? null,
    stage: "new",
    notes: input.notes ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
    createdAt: now,
    updatedAt: now,
    convertedMatterId: null,
    convertedAt: null,
  };
  await fireWebhook("lead.created", lead);
  return lead;
}

export async function updateLead(
  id: string,
  updates: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    stage?: LeadStage;
    notes?: string | null;
    assignedToUserId?: string | null;
  },
): Promise<Lead | null> {
  const existing = await getLead(id);
  if (!existing) return null;

  // Explicit per-field fallback, not a plain object spread — the caller's
  // updates object always has every key present (possibly as `undefined`
  // for "not changing this field"), and spreading an explicit `undefined`
  // over `existing` would overwrite it rather than leave it alone.
  const next: Lead = {
    ...existing,
    name: updates.name ?? existing.name,
    email: updates.email !== undefined ? updates.email : existing.email,
    phone: updates.phone !== undefined ? updates.phone : existing.phone,
    source: updates.source !== undefined ? updates.source : existing.source,
    stage: updates.stage ?? existing.stage,
    notes: updates.notes !== undefined ? updates.notes : existing.notes,
    assignedToUserId: updates.assignedToUserId !== undefined ? updates.assignedToUserId : existing.assignedToUserId,
    updatedAt: new Date().toISOString(),
  };
  db.prepare(
    `UPDATE leads SET name = ?, email = ?, phone = ?, source = ?, stage = ?, notes = ?, assignedToUserId = ?, updatedAt = ?
     WHERE id = ?`,
  ).run(next.name, next.email, next.phone, next.source, next.stage, next.notes, next.assignedToUserId, next.updatedAt, id);

  if (updates.stage && updates.stage !== existing.stage) {
    await recordAuditEvent("lead_stage_changed", null, `Lead "${next.name}" moved to ${updates.stage}`);
  }

  return next;
}

export async function deleteLead(id: string): Promise<void> {
  const lead = await getLead(id);
  db.prepare("DELETE FROM leads WHERE id = ?").run(id);
  if (lead) {
    await recordAuditEvent("lead_deleted", null, `Deleted lead "${lead.name}"`);
  }
}

// Reuses createMatter() — the exact same path the "New matter" form uses,
// including its own client find-or-create logic — rather than duplicating
// that here.
export async function convertLeadToMatter(
  id: string,
  input: { title: string; matterType: string },
): Promise<{ lead: Lead; matter: Matter }> {
  const lead = await getLead(id);
  if (!lead) throw new Error("Lead not found");
  if (lead.convertedMatterId) throw new Error("This lead has already been converted to a matter");

  const matter = await createMatter({
    title: input.title,
    clientName: lead.name,
    clientEmail: lead.email ?? undefined,
    matterType: input.matterType,
  });

  const updatedAt = new Date().toISOString();
  db.prepare(
    "UPDATE leads SET stage = 'won', convertedMatterId = ?, convertedAt = ?, updatedAt = ? WHERE id = ?",
  ).run(matter.id, updatedAt, updatedAt, id);

  await recordAuditEvent(
    "lead_converted",
    matter.id,
    `Converted lead "${lead.name}" to matter "${matter.title}"`,
  );

  return {
    lead: { ...lead, stage: "won", convertedMatterId: matter.id, convertedAt: updatedAt, updatedAt },
    matter,
  };
}
