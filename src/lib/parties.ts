import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { Party } from "./types";

export async function listParties(matterId: string): Promise<Party[]> {
  return db
    .prepare("SELECT * FROM parties WHERE matterId = ? ORDER BY createdAt ASC")
    .all(matterId)
    .map((row) => toPlain<Party>(row));
}

export async function getParty(id: string): Promise<Party | null> {
  const row = db.prepare("SELECT * FROM parties WHERE id = ?").get(id);
  return row ? toPlain<Party>(row) : null;
}

export async function addParty(
  matterId: string,
  input: {
    name: string;
    role: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  },
): Promise<Party> {
  const name = input.name.trim();
  const role = input.role.trim();
  if (!name) throw new Error("Party name is required");
  if (!role) throw new Error("Party role is required");

  const party: Party = {
    id: crypto.randomUUID(),
    matterId,
    name,
    role,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO parties (id, matterId, name, role, email, phone, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    party.id,
    party.matterId,
    party.name,
    party.role,
    party.email,
    party.phone,
    party.notes,
    party.createdAt,
  );
  await recordAuditEvent("party_added", matterId, `Added ${role.toLowerCase()} "${name}"`);
  return party;
}

export async function updateParty(
  id: string,
  fields: {
    name?: string;
    role?: string;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  },
): Promise<Party | null> {
  const existing = await getParty(id);
  if (!existing) return null;

  const name = fields.name !== undefined ? fields.name.trim() : existing.name;
  const role = fields.role !== undefined ? fields.role.trim() : existing.role;
  if (!name) throw new Error("Party name is required");
  if (!role) throw new Error("Party role is required");
  const email = fields.email !== undefined ? fields.email?.trim() || null : existing.email;
  const phone = fields.phone !== undefined ? fields.phone?.trim() || null : existing.phone;
  const notes = fields.notes !== undefined ? fields.notes?.trim() || null : existing.notes;

  db.prepare(
    "UPDATE parties SET name = ?, role = ?, email = ?, phone = ?, notes = ? WHERE id = ?",
  ).run(name, role, email, phone, notes, id);
  await recordAuditEvent(
    "party_updated",
    existing.matterId,
    `Updated ${role.toLowerCase()} "${name}"`,
  );
  return getParty(id);
}

export async function deleteParty(id: string): Promise<boolean> {
  const party = await getParty(id);
  if (!party) return false;

  db.prepare("DELETE FROM parties WHERE id = ?").run(id);
  await recordAuditEvent(
    "party_removed",
    party.matterId,
    `Removed ${party.role.toLowerCase()} "${party.name}"`,
  );
  return true;
}
