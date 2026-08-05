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
  draft_agent_run: "Self-checking drafting agent ran",
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
  reference_document_approved: "Reference document approved for reuse",
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
  defence_graph_generated: "Defence graph generated",
  backup_created: "Backup created",
  backup_deleted: "Backup deleted",
  audit_chain_reanchored: "Audit chain re-anchored",
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
// what's stored. A mismatch means a row was edited or deleted since it was
// written — including, historically, by the app's own deleteMatter()
// cascading a DELETE FROM audit_log WHERE matterId = ?, which broke the
// global chain for every row after it (fixed — audit rows are no longer
// deleted on matter deletion — but see reanchorAuditLogIntegrity() below
// for what to do about damage from before that fix).
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

// Recomputes every row's hash from genesis over whatever rows currently
// exist (i.e. it heals gaps left by rows that were legitimately deleted —
// like the deleteMatter() bug above — by re-chaining around them), then
// records a permanent, visible audit_chain_reanchored event explaining
// why. This is NOT a silent fix: re-anchoring makes past damage from a
// known, root-caused, now-fixed bug stop permanently flagging as "broken"
// on every future check, at the cost of that past damage no longer being
// independently provable from the chain alone — the record of it having
// happened lives in this event, in the git history of the fix, and in
// docs/ROADMAP.md instead. Only ever call this after confirming *why* the
// chain broke — re-anchoring over unexplained tampering would defeat the
// entire point of the feature.
export async function reanchorAuditLogIntegrity(reason: string): Promise<{ reanchoredCount: number }> {
  const rows = db
    .prepare(
      "SELECT rowid as rowid, id, action, matterId, detail, createdAt, userId FROM audit_log ORDER BY rowid ASC",
    )
    .all() as unknown as {
    rowid: number;
    id: string;
    action: string;
    matterId: string | null;
    detail: string;
    createdAt: string;
    userId: string | null;
  }[];

  let prevHash = AUDIT_GENESIS_HASH;
  const update = db.prepare("UPDATE audit_log SET hash = ? WHERE rowid = ?");
  for (const row of rows) {
    const hash = computeAuditRowHash(prevHash, row);
    update.run(hash, row.rowid);
    prevHash = hash;
  }

  await recordAuditEvent("audit_chain_reanchored", null, reason);
  return { reanchoredCount: rows.length };
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
