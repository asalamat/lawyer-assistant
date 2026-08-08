import { getCurrentUser } from "./auth";
import db, { AUDIT_GENESIS_HASH, computeAuditRowHash, toPlain } from "./db";
import type { AuditEntry } from "./types";

export const ACTION_LABELS: Record<string, string> = {
  matter_created: "Matter created",
  document_uploaded: "Document uploaded",
  duplicate_document_uploaded: "Duplicate document uploaded",
  near_duplicate_document_detected: "Near-duplicate document detected",
  mfa_enabled: "Two-factor authentication enabled",
  mfa_disabled: "Two-factor authentication disabled",
  malware_detected: "Malware detected and quarantined",
  contradiction_analysis_generated: "Contradiction analysis generated",
  exhibit_list_generated: "Exhibit list generated",
  disclosure_checklist_generated: "Disclosure checklist generated",
  crown_position_analysis_generated: "Crown-position analysis generated",
  privilege_review_generated: "Privilege & redaction review generated",
  matter_ethical_wall_applied: "Ethical wall applied",
  matter_ethical_wall_released: "Ethical wall released",
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
  client_created: "Client created",
  client_updated: "Client updated",
  client_deleted: "Client deleted",
  legislation_watch_added: "Legislation watch added",
  legislation_watch_removed: "Legislation watch removed",
  legislation_watch_changed: "Legislation watch detected a change",
  case_noteup_checked: "Case citations checked against CanLII",
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
  matter_team_member_added: "Matter team member assigned",
  matter_team_member_removed: "Matter team member removed",
  signable_document_created: "Signable document prepared",
  signable_document_sent: "Signing link issued to client",
  signable_document_signed: "Document signed by client",
  signable_document_declined: "Document declined by client",
  signable_document_voided: "Signable document voided",
  party_added: "Party added to matter",
  party_updated: "Party updated",
  party_removed: "Party removed from matter",
  related_matter_linked: "Matter linked to related matter",
  related_matter_unlinked: "Related matter unlinked",
  intake_questionnaire_sent: "Intake questionnaire sent to client",
  intake_questionnaire_completed: "Intake questionnaire completed by client",
  client_portal_access_granted: "Client portal access granted",
  client_portal_password_reset: "Client portal password reset",
  document_shared_with_client: "Document shared with client portal",
  document_unshared_from_client: "Document unshared from client portal",
  client_portal_document_downloaded: "Document downloaded from client portal",
  dlp_bulk_export_alert: "Unusual bulk export/download activity flagged",
  backup_downloaded: "Backup downloaded",
  trust_deposit_recorded: "Trust deposit recorded",
  trust_withdrawal_recorded: "Trust withdrawal recorded",
  trust_transfer_recorded: "Trust transfer to operating recorded",
  trust_account_reconciled: "Trust account reconciled",
  deadline_computed: "Deadline computed from a rule",
  portal_message_sent: "Client portal message sent",
  document_assembled: "Document generated from a template",
  lead_created: "Lead added",
  lead_stage_changed: "Lead stage changed",
  lead_converted: "Lead converted to matter",
  lead_deleted: "Lead deleted",
  feature_request_submitted: "Wish item submitted",
  feature_request_status_changed: "Wish item status changed",
  feature_request_deleted: "Wish item deleted",
  task_created: "Task added",
  task_completed: "Task completed",
  task_deleted: "Task deleted",
  calendar_sync_toggled: "Calendar sync toggled",
  deadline_pushed_to_calendar: "Deadline pushed to calendar",
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
