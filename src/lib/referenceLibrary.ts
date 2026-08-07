import { mkdir, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { recordAuditEvent } from "./auditLog";
import { scanReferenceDocumentForSensitiveContent } from "./claude";
import { encryptFile } from "./crypto";
import db, { toPlain } from "./db";
import { extractDocumentText, isExtractableDocument } from "./textExtraction";
import type { ReferenceDocument } from "./types";

const REFERENCE_DIR = path.join(process.cwd(), "data", "reference-uploads");

export async function listReferenceDocuments(): Promise<ReferenceDocument[]> {
  return db
    .prepare("SELECT * FROM reference_documents ORDER BY uploadedAt DESC")
    .all()
    .map((row) => toPlain<ReferenceDocument>(row));
}

export async function addReferenceDocument(file: File): Promise<ReferenceDocument> {
  if (!existsSync(REFERENCE_DIR)) await mkdir(REFERENCE_DIR, { recursive: true });

  const id = crypto.randomUUID();
  const storagePath = path.join(REFERENCE_DIR, `${id}-${file.name}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  await writeFile(storagePath, await encryptFile(bytes));

  // Flag likely one-client personal/privileged content before it enters a
  // shelf meant for cross-matter reuse — a lawyer still has to approve
  // either way, this just surfaces a reason to look closer. Best-effort:
  // if extraction or the AI call fails, upload still succeeds unflagged
  // rather than blocking on it.
  let sensitivityFlag: string | null = null;
  if (isExtractableDocument(file.name)) {
    try {
      const text = await extractDocumentText(file.name, storagePath);
      if (text) sensitivityFlag = await scanReferenceDocumentForSensitiveContent(text);
    } catch {
      sensitivityFlag = null;
    }
  }

  const document: ReferenceDocument = {
    id,
    fileName: file.name,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    storagePath,
    contentHash,
    approved: 0,
    approvedBy: null,
    approvedAt: null,
    sensitivityFlag,
    extractionStatus: null,
    extractionError: null,
    extractionCheckedAt: null,
  };
  db.prepare(
    `INSERT INTO reference_documents
       (id, fileName, sizeBytes, uploadedAt, storagePath, contentHash, approved, approvedBy, approvedAt, sensitivityFlag)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?)`,
  ).run(
    document.id,
    document.fileName,
    document.sizeBytes,
    document.uploadedAt,
    document.storagePath,
    document.contentHash,
    document.sensitivityFlag,
  );
  await recordAuditEvent(
    "reference_document_uploaded",
    null,
    `Uploaded "${document.fileName}" to the reference library, pending approval${
      sensitivityFlag ? ` (flagged: ${sensitivityFlag})` : ""
    }`,
  );
  return document;
}

// Lawyer/admin sign-off before a reference document becomes attachable to
// matters — the point of the vision doc's "lawyer approval before reuse"
// step, kept lightweight (no separate review queue table) since the
// reference_documents row itself carries everything needed to decide.
export async function approveReferenceDocument(
  id: string,
  approvedByUserId: string,
): Promise<void> {
  const row = db
    .prepare("SELECT fileName FROM reference_documents WHERE id = ?")
    .get(id) as unknown as { fileName: string } | undefined;
  if (!row) throw new Error("Reference document not found");

  db.prepare(
    "UPDATE reference_documents SET approved = 1, approvedBy = ?, approvedAt = ? WHERE id = ?",
  ).run(approvedByUserId, new Date().toISOString(), id);
  await recordAuditEvent(
    "reference_document_approved",
    null,
    `Approved "${row.fileName}" for reuse across matters`,
  );
}

export async function deleteReferenceDocument(id: string): Promise<void> {
  const row = db
    .prepare("SELECT fileName, storagePath FROM reference_documents WHERE id = ?")
    .get(id) as unknown as { fileName: string; storagePath: string } | undefined;
  if (!row) return;

  db.prepare("DELETE FROM matter_reference_documents WHERE referenceDocumentId = ?").run(id);
  db.prepare("DELETE FROM reference_documents WHERE id = ?").run(id);
  if (existsSync(row.storagePath)) await rm(row.storagePath, { force: true });

  await recordAuditEvent("reference_document_deleted", null, `Deleted "${row.fileName}" from the reference library`);
}

export async function listAttachedReferenceDocuments(matterId: string): Promise<ReferenceDocument[]> {
  return db
    .prepare(
      `SELECT rd.* FROM reference_documents rd
       JOIN matter_reference_documents mrd ON mrd.referenceDocumentId = rd.id
       WHERE mrd.matterId = ?
       ORDER BY rd.fileName ASC`,
    )
    .all(matterId)
    .map((row) => toPlain<ReferenceDocument>(row));
}

export async function attachReferenceDocument(
  matterId: string,
  referenceDocumentId: string,
): Promise<void> {
  const doc = db
    .prepare("SELECT fileName, approved FROM reference_documents WHERE id = ?")
    .get(referenceDocumentId) as unknown as { fileName: string; approved: number } | undefined;
  if (!doc) throw new Error("Reference document not found");
  if (!doc.approved) {
    throw new Error("This reference document is pending approval and can't be attached yet");
  }

  db.prepare(
    `INSERT INTO matter_reference_documents (matterId, referenceDocumentId, attachedAt) VALUES (?, ?, ?)
     ON CONFLICT(matterId, referenceDocumentId) DO NOTHING`,
  ).run(matterId, referenceDocumentId, new Date().toISOString());
  await recordAuditEvent(
    "reference_document_attached",
    matterId,
    `Attached reference document "${doc.fileName}"`,
  );
}

export async function detachReferenceDocument(
  matterId: string,
  referenceDocumentId: string,
): Promise<void> {
  const doc = db
    .prepare("SELECT fileName FROM reference_documents WHERE id = ?")
    .get(referenceDocumentId) as unknown as { fileName: string } | undefined;

  db.prepare(
    "DELETE FROM matter_reference_documents WHERE matterId = ? AND referenceDocumentId = ?",
  ).run(matterId, referenceDocumentId);
  await recordAuditEvent(
    "reference_document_detached",
    matterId,
    `Detached reference document "${doc?.fileName ?? referenceDocumentId}"`,
  );
}
