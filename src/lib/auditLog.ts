import db, { toPlain } from "./db";
import type { AuditEntry } from "./types";

export const ACTION_LABELS: Record<string, string> = {
  matter_created: "Matter created",
  document_uploaded: "Document uploaded",
  duplicate_document_uploaded: "Duplicate document uploaded",
  chat_question_asked: "Chat question asked",
  chat_feedback_recorded: "Chat feedback recorded",
  digest_generated: "Matter digest generated",
  deadlines_extracted: "Deadlines extracted",
  draft_generated: "Draft generated",
  evidence_matrix_generated: "Evidence matrix generated",
  independent_review_generated: "Independent review generated",
  matter_status_changed: "Matter status changed",
  matter_rate_updated: "Matter billing rate updated",
  email_account_connected: "Email account connected",
  email_account_disconnected: "Email account disconnected",
  time_entry_logged: "Time entry logged",
  time_entry_deleted: "Time entry deleted",
  invoice_created: "Invoice created",
  invoice_sent: "Invoice emailed",
  invoice_marked_paid: "Invoice marked paid",
  invoice_marked_unpaid: "Invoice marked unpaid",
};

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

export async function listAuditLogForMatter(matterId: string): Promise<AuditEntry[]> {
  return db
    .prepare("SELECT * FROM audit_log WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<AuditEntry>(row));
}
