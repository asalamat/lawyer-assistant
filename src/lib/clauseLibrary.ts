import { randomUUID } from "crypto";
import db, { toPlain } from "./db";
import type { ClauseLibraryEntry } from "./types";

export async function listClauseLibraryEntries(): Promise<ClauseLibraryEntry[]> {
  return db
    .prepare("SELECT * FROM clause_library_entries ORDER BY clauseType ASC")
    .all()
    .map((row) => toPlain<ClauseLibraryEntry>(row));
}

export async function createClauseLibraryEntry(input: {
  clauseType: string;
  preferredLanguage: string;
  fallbackLanguage?: string | null;
  unacceptableLanguage?: string | null;
  notes?: string | null;
}): Promise<ClauseLibraryEntry> {
  const clauseType = input.clauseType.trim();
  if (!clauseType) throw new Error("Clause type is required");
  if (!input.preferredLanguage.trim()) throw new Error("Preferred language can't be empty");

  const entry: ClauseLibraryEntry = {
    id: randomUUID(),
    clauseType,
    preferredLanguage: input.preferredLanguage,
    fallbackLanguage: input.fallbackLanguage ?? null,
    unacceptableLanguage: input.unacceptableLanguage ?? null,
    notes: input.notes ?? null,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO clause_library_entries (id, clauseType, preferredLanguage, fallbackLanguage, unacceptableLanguage, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.clauseType,
    entry.preferredLanguage,
    entry.fallbackLanguage,
    entry.unacceptableLanguage,
    entry.notes,
    entry.createdAt,
  );
  return entry;
}

export async function deleteClauseLibraryEntry(id: string): Promise<void> {
  db.prepare("DELETE FROM clause_library_entries WHERE id = ?").run(id);
}
