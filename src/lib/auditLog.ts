import { getCurrentUser } from "./auth";
import db, { AUDIT_GENESIS_HASH, computeAuditRowHash, toPlain } from "./db";
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
  matter_deleted: "Matter deleted",
  matter_note_added: "Matter note added",
  email_account_connected: "Email account connected",
  email_account_disconnected: "Email account disconnected",
  email_imported_to_matter: "Email imported as document",
  time_entry_logged: "Time entry logged",
  time_entry_deleted: "Time entry deleted",
  invoice_created: "Invoice created",
  invoice_sent: "Invoice emailed",
  matter_email_sent: "Email sent",
  invoice_marked_paid: "Invoice marked paid",
  invoice_marked_unpaid: "Invoice marked unpaid",
  reference_document_uploaded: "Reference document uploaded",
  reference_document_deleted: "Reference document deleted",
  reference_document_attached: "Reference document attached to matter",
  reference_document_detached: "Reference document detached from matter",
  legislation_watch_added: "Legislation watch added",
  legislation_watch_removed: "Legislation watch removed",
  legislation_watch_changed: "Legislation watch detected a change",
  user_created: "User account created",
  user_activated: "User account reactivated",
  user_deactivated: "User account deactivated",
  user_role_changed: "User role changed",
  user_password_reset: "User password reset by admin",
  matter_classification_changed: "Matter classification changed",
  matter_legal_hold_applied: "Matter placed on legal hold",
  matter_legal_hold_released: "Matter legal hold released",
  matter_retention_date_set: "Matter retention date set",
  email_draft_generated: "Smart email draft generated",
  evidence_graph_generated: "Evidence graph generated",
};

export async function recordAuditEvent(
  action: string,
  matterId: string | null,
  detail: string,
): Promise<void> {
  // Attributed to whoever's session made the request that triggered this
  // event, if any — null for unattended paths (e.g. the legislation-watch
  // cron endpoint, which has no session cookie).
  const user = await getCurrentUser().catch(() => null);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const userId = user?.id ?? null;

  const lastRow = db.prepare("SELECT hash FROM audit_log ORDER BY rowid DESC LIMIT 1").get() as
    | { hash: string | null }
    | undefined;
  const prevHash = lastRow?.hash ?? AUDIT_GENESIS_HASH;
  const hash = computeAuditRowHash(prevHash, { id, action, matterId, detail, createdAt, userId });

  db.prepare(
    "INSERT INTO audit_log (id, action, matterId, detail, createdAt, userId, userName, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, action, matterId, detail, createdAt, userId, user?.name ?? null, hash);
}

export interface AuditIntegrityResult {
  valid: boolean;
  checkedCount: number;
  brokenAtId: string | null;
}

// Recomputes the hash chain over the entire audit log and compares it to
// what's stored. A mismatch means a row was edited, deleted, or inserted
// out of band since it was written — this can't happen through the app's
// own code paths, only via direct DB access.
export async function verifyAuditLogIntegrity(): Promise<AuditIntegrityResult> {
  const rows = db
    .prepare(
      "SELECT id, action, matterId, detail, createdAt, userId, hash FROM audit_log ORDER BY rowid ASC",
    )
    .all() as { id: string; action: string; matterId: string | null; detail: string; createdAt: string; userId: string | null; hash: string | null }[];

  let prevHash = AUDIT_GENESIS_HASH;
  for (const row of rows) {
    const expected = computeAuditRowHash(prevHash, row);
    if (row.hash !== expected) {
      return { valid: false, checkedCount: rows.length, brokenAtId: row.id };
    }
    prevHash = expected;
  }
  return { valid: true, checkedCount: rows.length, brokenAtId: null };
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
