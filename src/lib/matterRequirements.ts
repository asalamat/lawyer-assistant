import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { MatterRequirement } from "./types";

export async function listMatterRequirements(matterId: string): Promise<MatterRequirement[]> {
  return db
    .prepare("SELECT * FROM matter_requirements WHERE matterId = ? ORDER BY completed ASC, createdAt ASC")
    .all(matterId)
    .map((row) => toPlain<MatterRequirement>(row));
}

export async function getMatterRequirement(id: string): Promise<MatterRequirement | null> {
  const row = db.prepare("SELECT * FROM matter_requirements WHERE id = ?").get(id);
  return row ? toPlain<MatterRequirement>(row) : null;
}

// key is set only for a template-seeded item (see requirementsChecklists.ts
// / seedRequirementsChecklist in matters.ts) — a lawyer-added extra item
// always has key: null.
export async function addMatterRequirement(
  matterId: string,
  label: string,
  key: string | null = null,
): Promise<MatterRequirement> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("A label is required");

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO matter_requirements (id, matterId, key, label, completed, completedAt, createdAt) VALUES (?, ?, ?, ?, 0, NULL, ?)",
  ).run(id, matterId, key, trimmed, createdAt);

  return { id, matterId, key, label: trimmed, completed: 0, completedAt: null, createdAt };
}

export async function toggleMatterRequirementComplete(
  id: string,
  completed: boolean,
): Promise<MatterRequirement | null> {
  const existing = await getMatterRequirement(id);
  if (!existing) return null;

  const completedAt = completed ? new Date().toISOString() : null;
  db.prepare("UPDATE matter_requirements SET completed = ?, completedAt = ? WHERE id = ?").run(
    completed ? 1 : 0,
    completedAt,
    id,
  );

  if (completed) {
    await recordAuditEvent("requirement_completed", existing.matterId, `Checked off requirement "${existing.label}"`);
  }

  return { ...existing, completed: completed ? 1 : 0, completedAt };
}

export async function deleteMatterRequirement(id: string): Promise<void> {
  const existing = await getMatterRequirement(id);
  db.prepare("DELETE FROM matter_requirements WHERE id = ?").run(id);
  if (existing) {
    await recordAuditEvent("requirement_deleted", existing.matterId, `Removed requirement "${existing.label}"`);
  }
}
