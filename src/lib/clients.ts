import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { Client, Matter } from "./types";

export async function listClients(): Promise<Client[]> {
  return db
    .prepare("SELECT * FROM clients ORDER BY name ASC")
    .all()
    .map((row) => toPlain<Client>(row));
}

export async function getClient(id: string): Promise<Client | null> {
  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  return row ? toPlain<Client>(row) : null;
}

export async function listMattersForClient(clientId: string): Promise<Matter[]> {
  return db
    .prepare("SELECT * FROM matters WHERE clientId = ? ORDER BY createdAt DESC")
    .all(clientId)
    .map((row) => toPlain<Matter>(row));
}

export async function createClient(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}): Promise<Client> {
  const name = input.name.trim();
  const email = input.email?.trim() || null;
  if (!name) throw new Error("Client name is required");

  const existing = db
    .prepare("SELECT id FROM clients WHERE name = ? AND COALESCE(email, '') = COALESCE(?, '')")
    .get(name, email) as { id: string } | undefined;
  if (existing) {
    throw new Error("A client with this name and email already exists");
  }

  const client: Client = {
    id: randomUUID(),
    name,
    email,
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO clients (id, name, email, phone, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(client.id, client.name, client.email, client.phone, client.notes, client.createdAt);
  await recordAuditEvent("client_created", null, `Created client "${client.name}"`);
  return client;
}

export async function updateClient(
  id: string,
  input: { name?: string; email?: string | null; phone?: string | null; notes?: string | null },
): Promise<Client | null> {
  const existing = await getClient(id);
  if (!existing) return null;

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (!name) throw new Error("Client name is required");
  const email = input.email !== undefined ? input.email?.trim() || null : existing.email;
  const phone = input.phone !== undefined ? input.phone?.trim() || null : existing.phone;
  const notes = input.notes !== undefined ? input.notes?.trim() || null : existing.notes;

  db.prepare("UPDATE clients SET name = ?, email = ?, phone = ?, notes = ? WHERE id = ?").run(
    name,
    email,
    phone,
    notes,
    id,
  );
  await recordAuditEvent("client_updated", null, `Updated client "${name}"`);
  return getClient(id);
}

// Blocked if any matter still references this client — matters.clientId
// has no database-level foreign key (see src/lib/db.ts's ensureColumn
// call for it), so nothing would stop an orphaned reference at the SQL
// level; this is the only thing standing between a delete and silently
// broken matter->client links.
export async function deleteClient(id: string): Promise<boolean> {
  const client = await getClient(id);
  if (!client) return false;

  const matters = await listMattersForClient(id);
  if (matters.length > 0) {
    throw new Error(
      `Can't delete "${client.name}" — ${matters.length} matter${matters.length > 1 ? "s" : ""} still reference${matters.length > 1 ? "" : "s"} this client. Close or reassign them first.`,
    );
  }

  db.prepare("DELETE FROM clients WHERE id = ?").run(id);
  await recordAuditEvent("client_deleted", null, `Deleted client "${client.name}"`);
  return true;
}

// Reuses an existing client if the name+email pair already exists (so a
// repeat client's matters stay linked under one entity), otherwise creates
// a new one. Matched on exact name+email rather than fuzzy matching — this
// is the deterministic "same client filled out the same way" case;
// checkConflicts (in matters.ts) handles the fuzzy "might be the same
// client, worth a human look" case separately, since those need different
// answers (auto-link vs. flag-for-review).
export async function findOrCreateClient(name: string, email: string | null): Promise<string> {
  const trimmedName = name.trim();
  const normalizedEmail = email?.trim() || null;
  const existing = db
    .prepare("SELECT id FROM clients WHERE name = ? AND COALESCE(email, '') = COALESCE(?, '')")
    .get(trimmedName, normalizedEmail) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = crypto.randomUUID();
  db.prepare("INSERT INTO clients (id, name, email, phone, notes, createdAt) VALUES (?, ?, ?, NULL, NULL, ?)").run(
    id,
    trimmedName,
    normalizedEmail,
    new Date().toISOString(),
  );
  return id;
}
