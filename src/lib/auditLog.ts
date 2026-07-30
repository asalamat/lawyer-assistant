import db, { toPlain } from "./db";
import type { AuditEntry } from "./types";

export async function recordAuditEvent(
  action: string,
  matterId: string | null,
  detail: string,
): Promise<void> {
  db.prepare(
    "INSERT INTO audit_log (id, action, matterId, detail, createdAt) VALUES (?, ?, ?, ?, ?)",
  ).run(crypto.randomUUID(), action, matterId, detail, new Date().toISOString());
}

export async function listAuditLog(limit = 200): Promise<AuditEntry[]> {
  return db
    .prepare("SELECT * FROM audit_log ORDER BY createdAt DESC LIMIT ?")
    .all(limit)
    .map((row) => toPlain<AuditEntry>(row));
}
