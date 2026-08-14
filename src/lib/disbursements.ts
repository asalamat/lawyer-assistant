import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { Disbursement } from "./types";

export async function listDisbursements(matterId: string): Promise<Disbursement[]> {
  return db
    .prepare("SELECT * FROM disbursements WHERE matterId = ? ORDER BY incurredOn DESC, createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<Disbursement>(row));
}

export async function listUnbilledDisbursements(matterId: string): Promise<Disbursement[]> {
  return db
    .prepare("SELECT * FROM disbursements WHERE matterId = ? AND invoiceId IS NULL ORDER BY incurredOn ASC")
    .all(matterId)
    .map((row) => toPlain<Disbursement>(row));
}

export async function listInvoiceDisbursements(invoiceId: string): Promise<Disbursement[]> {
  return db
    .prepare("SELECT * FROM disbursements WHERE invoiceId = ? ORDER BY incurredOn ASC")
    .all(invoiceId)
    .map((row) => toPlain<Disbursement>(row));
}

// Receipt capture: the caller (the API route) uploads the receipt via
// matters.ts's addDocument() first — same malware scan, encryption-at-rest,
// and photo-analysis/OCR pipeline every other document gets — and passes
// the resulting document id in here. Kept out of this module to avoid a
// circular import (matters.ts needs to import from here for invoicing).
export async function addDisbursement(
  matterId: string,
  input: {
    incurredOn: string;
    category: string;
    description: string;
    amount: number;
    receiptDocumentId?: string | null;
    userId?: string | null;
  },
): Promise<Disbursement> {
  const receiptDocumentId = input.receiptDocumentId ?? null;

  const entry: Disbursement = {
    id: randomUUID(),
    matterId,
    incurredOn: input.incurredOn,
    category: input.category,
    description: input.description,
    amount: input.amount,
    receiptDocumentId,
    invoiceId: null,
    userId: input.userId ?? null,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO disbursements (id, matterId, incurredOn, category, description, amount, receiptDocumentId, invoiceId, userId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.matterId,
    entry.incurredOn,
    entry.category,
    entry.description,
    entry.amount,
    entry.receiptDocumentId,
    entry.invoiceId,
    entry.userId,
    entry.createdAt,
  );
  await recordAuditEvent(
    "disbursement_logged",
    matterId,
    `Logged disbursement: ${entry.category} — $${entry.amount.toFixed(2)}`,
  );
  return entry;
}

export async function deleteDisbursement(matterId: string, disbursementId: string): Promise<void> {
  const existing = db
    .prepare("SELECT invoiceId FROM disbursements WHERE id = ? AND matterId = ?")
    .get(disbursementId, matterId) as unknown as { invoiceId: string | null } | undefined;
  if (existing?.invoiceId) {
    throw new Error("This disbursement has already been invoiced and can't be deleted.");
  }
  db.prepare("DELETE FROM disbursements WHERE id = ? AND matterId = ?").run(disbursementId, matterId);
  await recordAuditEvent("disbursement_deleted", matterId, "Deleted a disbursement");
}
