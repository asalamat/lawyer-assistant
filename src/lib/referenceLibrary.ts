import { mkdir, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { recordAuditEvent } from "./auditLog";
import { encryptFile } from "./crypto";
import db, { toPlain } from "./db";
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

  const document: ReferenceDocument = {
    id,
    fileName: file.name,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    storagePath,
    contentHash,
  };
  db.prepare(
    "INSERT INTO reference_documents (id, fileName, sizeBytes, uploadedAt, storagePath, contentHash) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    document.id,
    document.fileName,
    document.sizeBytes,
    document.uploadedAt,
    document.storagePath,
    document.contentHash,
  );
  await recordAuditEvent("reference_document_uploaded", null, `Uploaded "${document.fileName}" to the reference library`);
  return document;
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
    .prepare("SELECT fileName FROM reference_documents WHERE id = ?")
    .get(referenceDocumentId) as unknown as { fileName: string } | undefined;
  if (!doc) throw new Error("Reference document not found");

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
