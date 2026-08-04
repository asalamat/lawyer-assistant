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
