import { randomUUID } from "crypto";
import db, { toPlain } from "./db";
import type { SavedReport } from "./types";

export async function listSavedReports(userId: string): Promise<SavedReport[]> {
  return db
    .prepare("SELECT * FROM saved_reports WHERE userId = ? ORDER BY createdAt DESC")
    .all(userId)
    .map((row) => toPlain<SavedReport>(row));
}

export async function createSavedReport(
  userId: string,
  label: string,
  query: string,
): Promise<SavedReport> {
  const savedReport: SavedReport = {
    id: randomUUID(),
    userId,
    label,
    query,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO saved_reports (id, userId, label, query, createdAt) VALUES (?, ?, ?, ?, ?)",
  ).run(savedReport.id, savedReport.userId, savedReport.label, savedReport.query, savedReport.createdAt);
  return savedReport;
}

// Scoped to the owning user — deleting someone else's saved report silently
// no-ops rather than erroring, same as saved searches.
export async function deleteSavedReport(userId: string, id: string): Promise<void> {
  db.prepare("DELETE FROM saved_reports WHERE id = ? AND userId = ?").run(id, userId);
}
