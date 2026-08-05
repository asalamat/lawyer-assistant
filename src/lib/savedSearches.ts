import { randomUUID } from "crypto";
import db, { toPlain } from "./db";
import type { SavedSearch } from "./types";

export async function listSavedSearches(userId: string): Promise<SavedSearch[]> {
  return db
    .prepare("SELECT * FROM saved_searches WHERE userId = ? ORDER BY createdAt DESC")
    .all(userId)
    .map((row) => toPlain<SavedSearch>(row));
}

export async function createSavedSearch(
  userId: string,
  label: string,
  query: string,
): Promise<SavedSearch> {
  const savedSearch: SavedSearch = {
    id: randomUUID(),
    userId,
    label,
    query,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO saved_searches (id, userId, label, query, createdAt) VALUES (?, ?, ?, ?, ?)",
  ).run(savedSearch.id, savedSearch.userId, savedSearch.label, savedSearch.query, savedSearch.createdAt);
  return savedSearch;
}

// Scoped to the owning user — deleting someone else's saved search silently
// no-ops rather than erroring, same as if it didn't exist.
export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
  db.prepare("DELETE FROM saved_searches WHERE id = ? AND userId = ?").run(id, userId);
}
