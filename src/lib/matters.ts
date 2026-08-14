import { mkdir, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { cache } from "react";
import { recordAuditEvent } from "./auditLog";
import { findOrCreateClient } from "./clients";
import { encryptFile } from "./crypto";
import db, { toPlain } from "./db";
import { nameSimilarity } from "./fuzzyMatch";
import { cosineSimilarity } from "./embeddings";
import { verifyCitations } from "./citationCheck";
import { extractTextTracked } from "./extractionStatus";
import { scanBuffer } from "./malwareScan";
import { maskForAI } from "./piiMask";
import { listAttachedReferenceDocuments } from "./referenceLibrary";
import { findLimitationPeriod } from "./limitationPeriods";
import { createSignableDocument, getSignableDocument, sendForSignature } from "./signableDocuments";
import { findTaskTemplate } from "./taskTemplates";
import { createTask } from "./tasks";
import {
  buildContextFromChunks,
  buildRetrievalConfidenceNote,
  ensureDocumentChunks,
  ensureReferenceDocumentChunks,
  getRelevantChunks,
} from "./rag";
import { fireWebhook } from "./webhooks";
import { getImageMimeType, isImageFile, isSafeToExtract, readPlaintextFile } from "./textExtraction";
import {
  analyzeImage,
  analyzePageForQuestion,
  extractDeadlines,
  extractMissingEvidenceItems,
  suggestMatterClassification,
  type ExtractedDeadline,
} from "./claude";
import { renderPdfPageToPng } from "./pdfPageRender";
import type {
  ChatMessage,
  Disbursement,
  Document,
  Draft,
  DraftType,
  EvidenceMatrix,
  IndependentReview,
  Invoice,
  Matter,
  MatterClassification,
  MatterDeadline,
  MatterDigest,
  MatterNote,
  MessageFeedback,
  TimeEntry,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
// Separate from UPLOADS_DIR on purpose — an infected file's bytes never
// land in the normal uploads tree at all (see addDocument), so nothing
// that walks that directory expecting readable matter documents can ever
// stumble onto one.
const QUARANTINE_DIR = path.join(DATA_DIR, "quarantine");

export async function listMatters(): Promise<Matter[]> {
  return db
    .prepare("SELECT * FROM matters ORDER BY createdAt DESC")
    .all()
    .map((row) => toPlain<Matter>(row));
}

// Wrapped in React's per-request cache — a matter's layout and every one
// of its ~20 tab pages independently call getMatter(id) with the same id
// on every navigation; without this each of those was its own round-trip
// to the database for identical data within the same request.
export const getMatter = cache(async (id: string): Promise<Matter | null> => {
  const row = db.prepare("SELECT * FROM matters WHERE id = ?").get(id);
  return row ? toPlain<Matter>(row) : null;
});

function generateFileNumber(createdAt: string): string {
  const year = createdAt.slice(0, 4);
  const { count } = db
    .prepare("SELECT COUNT(*) as count FROM matters WHERE fileNumber LIKE ?")
    .get(`${year}-%`) as { count: number };
  return `${year}-${String(count + 1).padStart(4, "0")}`;
}

export interface ConflictMatch {
  matterId: string;
  matterTitle: string;
  fileNumber: string;
  matchedOn: string;
  matchType: "substring" | "similar-name";
}

// Substring matching alone misses near-miss spellings ("Jon Smith" vs
// "John Smith") — this adds a fuzzy pass over every existing client name,
// in addition to the exact substring check. Still not a full conflicts
// system (it only compares against this app's own client names, not
// opposing parties, witnesses, or related entities mentioned inside
// documents — that would need party extraction from document text, a much
// bigger feature not attempted here).
const SIMILARITY_THRESHOLD = 0.8;

export async function checkConflicts(clientName: string): Promise<ConflictMatch[]> {
  const trimmed = clientName.trim();
  if (!trimmed) return [];

  const substringRows = db
    .prepare("SELECT id, title, fileNumber, clientName FROM matters WHERE clientName LIKE ?")
    .all(`%${trimmed}%`) as { id: string; title: string; fileNumber: string; clientName: string }[];

  const matchedMatterIds = new Set(substringRows.map((r) => r.id));
  const matches: ConflictMatch[] = substringRows.map((row) => ({
    matterId: row.id,
    matterTitle: row.title,
    fileNumber: row.fileNumber,
    matchedOn: row.clientName,
    matchType: "substring",
  }));

  const allRows = db.prepare("SELECT id, title, fileNumber, clientName FROM matters").all() as {
    id: string;
    title: string;
    fileNumber: string;
    clientName: string;
  }[];
  for (const row of allRows) {
    if (matchedMatterIds.has(row.id)) continue;
    if (nameSimilarity(trimmed, row.clientName) >= SIMILARITY_THRESHOLD) {
      matches.push({
        matterId: row.id,
        matterTitle: row.title,
        fileNumber: row.fileNumber,
        matchedOn: row.clientName,
        matchType: "similar-name",
      });
      matchedMatterIds.add(row.id);
    }
  }

  return matches;
}

export async function createMatter(input: {
  title: string;
  clientName: string;
  clientEmail?: string;
  matterType: string;
  hourlyRate?: number;
  createdByUserId?: string | null;
}): Promise<Matter> {
  const createdAt = new Date().toISOString();
  const clientEmail = input.clientEmail?.trim() || null;
  const clientId = await findOrCreateClient(input.clientName, clientEmail);
  const matter: Matter = {
    id: crypto.randomUUID(),
    fileNumber: generateFileNumber(createdAt),
    title: input.title,
    clientName: input.clientName,
    clientEmail,
    clientId,
    matterType: input.matterType,
    status: "open",
    hourlyRate: input.hourlyRate ?? null,
    classification: "standard",
    legalHold: 0,
    legalHoldReason: null,
    retentionDate: null,
    ethicalWall: 0,
    createdAt,
    retainerThreshold: null,
  };
  db.prepare(
    "INSERT INTO matters (id, fileNumber, title, clientName, clientEmail, clientId, matterType, status, hourlyRate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    matter.id,
    matter.fileNumber,
    matter.title,
    matter.clientName,
    matter.clientEmail,
    matter.clientId,
    matter.matterType,
    matter.status,
    matter.hourlyRate,
    matter.createdAt,
  );
  await recordAuditEvent(
    "matter_created",
    matter.id,
    `Created matter "${matter.title}" (${matter.fileNumber})`,
  );
  await fireWebhook("matter.created", matter);
  await seedDefaultTasks(matter, input.createdByUserId ?? null);
  await seedLimitationDeadline(matter);
  return matter;
}

// Best-effort, non-fatal, same reasoning as seedDefaultTasks below — a
// broken template must never block matter creation. Computed from
// matter-open date only, since that's the only date this form collects;
// the deadline's own description says explicitly that a real limitation
// period depends on facts (date of loss, discoverability, etc.) this app
// has no way to know at intake.
async function seedLimitationDeadline(matter: Matter): Promise<void> {
  try {
    const template = findLimitationPeriod(matter.matterType);
    if (!template) return;
    const dueDate = new Date(
      new Date(matter.createdAt).getTime() + template.offsetDays * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO matter_deadlines (id, matterId, description, dueDate, sourceDocument, source, createdAt)
       VALUES (?, ?, ?, ?, NULL, 'limitation-period', ?)`,
    ).run(id, matter.id, template.description, dueDate, createdAt);
    await recordAuditEvent(
      "deadline_computed",
      matter.id,
      `Seeded a possible limitation-period deadline (${dueDate}) — verify against current legislation`,
    );
  } catch {
    // A broken template must never block matter creation.
  }
}

// Best-effort, non-fatal — matter creation must succeed even if seeding its
// starter checklist fails, same reasoning as the deadline-extraction/
// classification side effects on document upload. matterType is free text
// (see the Matter type/db schema), so this is a fuzzy, case-insensitive
// match with a silent no-op when nothing matches, not a required lookup.
async function seedDefaultTasks(matter: Matter, createdByUserId: string | null): Promise<void> {
  try {
    const template = findTaskTemplate(matter.matterType);
    if (!template) return;
    const createdAtMs = new Date(matter.createdAt).getTime();
    for (const item of template) {
      const dueDate =
        item.dueOffsetDays !== undefined
          ? new Date(createdAtMs + item.dueOffsetDays * 24 * 60 * 60 * 1000).toISOString()
          : null;
      await createTask({
        matterId: matter.id,
        title: item.title,
        dueDate,
        createdByUserId,
      });
    }
  } catch {
    // A broken template must never block matter creation.
  }
}

export async function updateMatterStatus(
  matterId: string,
  status: Matter["status"],
): Promise<Matter | null> {
  db.prepare("UPDATE matters SET status = ? WHERE id = ?").run(status, matterId);
  const matter = await getMatter(matterId);
  if (matter) {
    await recordAuditEvent("matter_status_changed", matterId, `Marked matter as ${status}`);
  }
  return matter;
}

export async function updateMatterHourlyRate(
  matterId: string,
  hourlyRate: number,
): Promise<Matter | null> {
  db.prepare("UPDATE matters SET hourlyRate = ? WHERE id = ?").run(hourlyRate, matterId);
  const matter = await getMatter(matterId);
  if (matter) {
    await recordAuditEvent(
      "matter_rate_updated",
      matterId,
      `Set default hourly rate to $${hourlyRate.toFixed(2)}/hr`,
    );
  }
  return matter;
}

// null clears the alert entirely (no threshold configured) rather than
// treating 0 as "alert below zero" — a matter with no retainer tracking at
// all shouldn't need to be given an unreachable threshold to opt out.
export async function updateMatterRetainerThreshold(
  matterId: string,
  retainerThreshold: number | null,
): Promise<Matter | null> {
  db.prepare("UPDATE matters SET retainerThreshold = ? WHERE id = ?").run(retainerThreshold, matterId);
  const matter = await getMatter(matterId);
  if (matter) {
    await recordAuditEvent(
      "matter_retainer_threshold_updated",
      matterId,
      retainerThreshold !== null
        ? `Set retainer low-balance alert threshold to $${retainerThreshold.toFixed(2)}`
        : "Cleared retainer low-balance alert threshold",
    );
  }
  return matter;
}

export async function setMatterClassification(
  matterId: string,
  classification: Matter["classification"],
): Promise<Matter | null> {
  db.prepare("UPDATE matters SET classification = ? WHERE id = ?").run(classification, matterId);
  const matter = await getMatter(matterId);
  if (matter) {
    await recordAuditEvent(
      "matter_classification_changed",
      matterId,
      `Set classification to ${classification}`,
    );
  }
  return matter;
}

export async function setMatterLegalHold(
  matterId: string,
  legalHold: boolean,
  reason?: string,
): Promise<Matter | null> {
  db.prepare("UPDATE matters SET legalHold = ?, legalHoldReason = ? WHERE id = ?").run(
    legalHold ? 1 : 0,
    legalHold ? (reason?.trim() || null) : null,
    matterId,
  );
  const matter = await getMatter(matterId);
  if (matter) {
    await recordAuditEvent(
      legalHold ? "matter_legal_hold_applied" : "matter_legal_hold_released",
      matterId,
      legalHold ? `Placed on legal hold${reason ? `: ${reason}` : ""}` : "Legal hold released",
    );
  }
  return matter;
}

// Off by default (every matter visible to every staff member, unchanged
// behaviour) — turning this on restricts the matter to matter_team members
// plus admins (enforced in src/proxy.ts). Doesn't validate the team is
// non-empty: an admin can still always get in, and warning-not-blocking
// keeps this simple rather than coupling matter and team-membership writes.
export async function setMatterEthicalWall(
  matterId: string,
  ethicalWall: boolean,
): Promise<Matter | null> {
  db.prepare("UPDATE matters SET ethicalWall = ? WHERE id = ?").run(ethicalWall ? 1 : 0, matterId);
  const matter = await getMatter(matterId);
  if (matter) {
    await recordAuditEvent(
      ethicalWall ? "matter_ethical_wall_applied" : "matter_ethical_wall_released",
      matterId,
      ethicalWall
        ? "Restricted this matter to its assigned team (ethical wall applied)"
        : "Removed the ethical wall — matter is visible to all staff again",
    );
  }
  return matter;
}

export async function setMatterRetentionDate(
  matterId: string,
  retentionDate: string | null,
): Promise<Matter | null> {
  db.prepare("UPDATE matters SET retentionDate = ? WHERE id = ?").run(retentionDate, matterId);
  const matter = await getMatter(matterId);
  if (matter) {
    await recordAuditEvent(
      "matter_retention_date_set",
      matterId,
      retentionDate ? `Set retention date to ${retentionDate}` : "Cleared retention date",
    );
  }
  return matter;
}

export async function deleteMatter(matterId: string): Promise<boolean> {
  const matter = await getMatter(matterId);
  if (!matter) return false;
  if (matter.legalHold) {
    throw new Error(
      "This matter is on legal hold and can't be deleted. Release the hold first if you're sure it's no longer needed.",
    );
  }

  db.prepare(
    "DELETE FROM message_feedback WHERE chatMessageId IN (SELECT id FROM chat_messages WHERE matterId = ?)",
  ).run(matterId);
  db.prepare("DELETE FROM chat_messages WHERE matterId = ?").run(matterId);
  // Must run before documents: a disbursement's receiptDocumentId FK would
  // otherwise still point at a row the next line is about to delete.
  db.prepare("DELETE FROM disbursements WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM documents WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM matter_digests WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM matter_deadlines WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM drafts WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM evidence_matrices WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM contradiction_analyses WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM exhibit_lists WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM disclosure_checklists WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM crown_position_analyses WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM privilege_reviews WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM independent_reviews WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM invoices WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM time_entries WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM trust_transactions WHERE matterId = ?").run(matterId);
  // notifications.matterId has a real FK to matters(id) — deadline/event/
  // retainer reminders all create rows here, so any matter that ever
  // triggered one couldn't be deleted without this.
  db.prepare("DELETE FROM notifications WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM portal_messages WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM assembled_documents WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM matter_notes WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM matter_reference_documents WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM document_chunks WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM agent_runs WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM parties WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM related_matters WHERE matterId = ? OR relatedMatterId = ?").run(
    matterId,
    matterId,
  );
  db.prepare("DELETE FROM matter_team WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM case_noteups WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM tasks WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM redline_analyses WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM missing_evidence_reports WHERE matterId = ?").run(matterId);
  db.prepare(
    "DELETE FROM signatures WHERE signableDocumentId IN (SELECT id FROM signable_documents WHERE matterId = ?)",
  ).run(matterId);
  db.prepare("DELETE FROM signable_documents WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM intake_responses WHERE matterId = ?").run(matterId);
  // Must go last of these: an outstanding /sign or /intake link is validated
  // against this table alone, so leaving a row behind would let a client keep
  // signing or submitting against a matter that no longer exists.
  db.prepare("DELETE FROM client_access_tokens WHERE matterId = ?").run(matterId);
  // Audit rows are deliberately NOT deleted here. Two reasons: an audit
  // trail is supposed to survive deletion of the thing it audited (real
  // compliance practice — "we deleted this matter" should still be
  // provable after the fact); and audit_log is hash-chained
  // (src/lib/db.ts) across the whole table, not per matter — deleting
  // rows out of the middle of that global sequence breaks the chain for
  // every row after them, which is exactly what happened here before this
  // fix (confirmed live: two gaps, 6 rows, from an earlier matter
  // deletion). The matter_deleted event itself, and every other row for
  // this matterId, now stay in place permanently.
  db.prepare("DELETE FROM matters WHERE id = ?").run(matterId);

  const matterDir = path.join(UPLOADS_DIR, matterId);
  if (existsSync(matterDir)) {
    await rm(matterDir, { recursive: true, force: true });
  }
  const matterQuarantineDir = path.join(QUARANTINE_DIR, matterId);
  if (existsSync(matterQuarantineDir)) {
    await rm(matterQuarantineDir, { recursive: true, force: true });
  }

  await recordAuditEvent(
    "matter_deleted",
    null,
    `Deleted matter "${matter.title}" (${matter.fileNumber})`,
  );
  return true;
}

export async function listDocuments(matterId: string): Promise<Document[]> {
  return db
    .prepare("SELECT * FROM documents WHERE matterId = ? ORDER BY uploadedAt DESC")
    .all(matterId)
    .map((row) => toPlain<Document>(row));
}

// Nothing is visible in the client portal (see clientPortal.ts) just
// because a client has an account — a lawyer has to opt each document in
// explicitly, one at a time, via this toggle.
export async function setDocumentSharedWithClient(
  matterId: string,
  documentId: string,
  shared: boolean,
): Promise<void> {
  const doc = db
    .prepare("SELECT fileName FROM documents WHERE id = ? AND matterId = ?")
    .get(documentId, matterId) as unknown as { fileName: string } | undefined;
  if (!doc) throw new Error("Document not found");

  db.prepare("UPDATE documents SET sharedWithClient = ? WHERE id = ?").run(shared ? 1 : 0, documentId);
  await recordAuditEvent(
    shared ? "document_shared_with_client" : "document_unshared_from_client",
    matterId,
    `${shared ? "Shared" : "Unshared"} "${doc.fileName}" ${shared ? "with" : "from"} the client portal`,
  );
}

// Every real filename an AI-generated answer/document could legitimately
// cite for this matter — its own documents plus whichever reference-library
// material is attached to it. Used to deterministically flag a citation
// that doesn't match anything real (see citationCheck.ts) — the
// "quality-control" pass every generated document gets, not just chat.
export async function getKnownFilenames(matterId: string): Promise<string[]> {
  const documents = await listDocuments(matterId);
  const referenceDocs = await listAttachedReferenceDocuments(matterId);
  return [...documents.map((d) => d.fileName), ...referenceDocs.map((d) => d.fileName)];
}

// The quality-control pass every generated document goes through: which
// cited filenames don't match anything real for this matter. Deterministic
// (no AI call) — see citationCheck.ts.
export async function findUnverifiedCitations(matterId: string, content: string): Promise<string[]> {
  const knownFilenames = await getKnownFilenames(matterId);
  return verifyCitations(content, knownFilenames)
    .filter((c) => !c.verified)
    .map((c) => c.filename);
}

export async function getDocument(matterId: string, documentId: string): Promise<Document | null> {
  const row = db
    .prepare("SELECT * FROM documents WHERE id = ? AND matterId = ?")
    .get(documentId, matterId);
  return row ? toPlain<Document>(row) : null;
}

// Extraction is idempotent/cached (see ensureChunksForSource) so a failed
// document never gets retried on its own — nothing re-triggers it once the
// upload-time attempt fails. This forces one now, on demand, for the review
// queue's "Retry" action.
export async function retryDocumentExtraction(
  matterId: string,
  documentId: string,
): Promise<Document | null> {
  const document = await getDocument(matterId, documentId);
  if (!document) return null;
  if (document.malwareScanStatus === "infected") {
    throw new Error("This document was quarantined as malware and can't be extracted or retried.");
  }
  await ensureDocumentChunks(document);
  return getDocument(matterId, documentId);
}

// Vision-model equivalent of retryDocumentExtraction — describes what's
// actually visible in a photo (an OCR pass alone finds no text in most
// photos), rather than just re-attempting OCR. Never throws past the
// caller: failure is recorded on the row so the UI can offer another
// retry, matching extractTextTracked's own never-fail contract.
const MAX_PHOTO_ANALYSIS_BYTES = 20 * 1024 * 1024;

export async function analyzeDocumentPhoto(
  matterId: string,
  documentId: string,
): Promise<Document | null> {
  const document = await getDocument(matterId, documentId);
  if (!document) return null;
  if (document.malwareScanStatus === "infected") {
    throw new Error("This document was quarantined as malware and can't be analyzed.");
  }
  if (!isImageFile(document.fileName)) {
    throw new Error("Photo analysis only applies to image files.");
  }

  db.prepare("UPDATE documents SET photoAnalysisStatus = 'pending' WHERE id = ?").run(documentId);

  try {
    const bytes = await readPlaintextFile(document.storagePath);
    if (bytes.length > MAX_PHOTO_ANALYSIS_BYTES) {
      throw new Error("This image is too large to analyze (20MB limit).");
    }
    const result = await analyzeImage(bytes, getImageMimeType(document.fileName));
    db.prepare(
      "UPDATE documents SET photoAnalysisStatus = 'ok', photoAnalysisResult = ?, photoAnalysisError = NULL, photoAnalyzedAt = ? WHERE id = ?",
    ).run(result, new Date().toISOString(), documentId);
    await recordAuditEvent(
      "photo_analysis_completed",
      matterId,
      `Analyzed the photo "${document.fileName}"`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare(
      "UPDATE documents SET photoAnalysisStatus = 'failed', photoAnalysisError = ?, photoAnalyzedAt = ? WHERE id = ?",
    ).run(message, new Date().toISOString(), documentId);
  }

  return getDocument(matterId, documentId);
}

// On-demand visual check of one specific page — not something run at
// upload time or cached, unlike photo analysis above. Text extraction
// (pdf-parse) can find the right page and question but has no way to see
// a checkbox mark, signature, or handwriting; this renders that one page
// as an image and asks a vision-capable model to look at it directly.
// Deliberately not persisted anywhere — a one-off answer to a one-off
// question, not a property of the document itself.
export async function inspectDocumentPageForQuestion(
  matterId: string,
  documentId: string,
  page: number,
  question: string,
): Promise<{ answer: string; pageCount: number; fileName: string }> {
  const document = await getDocument(matterId, documentId);
  if (!document) throw new Error("Document not found");
  if (document.malwareScanStatus === "infected") {
    throw new Error("This document was quarantined as malware and can't be inspected.");
  }
  if (!document.fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Visual page inspection only applies to PDF documents.");
  }

  const { buffer, pageCount } = await renderPdfPageToPng(document.storagePath, page);
  const answer = await analyzePageForQuestion(buffer, "image/png", question);

  await recordAuditEvent(
    "document_page_inspected",
    matterId,
    `Visually inspected "${document.fileName}" page ${page} for: ${question}`,
  );

  return { answer, pageCount, fileName: document.fileName };
}

export async function addDocument(
  matterId: string,
  file: File,
  parentDocumentId: string | null = null,
): Promise<Document> {
  const id = crypto.randomUUID();
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");

  // Scanned before it's written anywhere real — an infected file's bytes
  // never touch the normal uploads directory at all, only the quarantine
  // one, so a bug elsewhere that iterates the uploads folder directly
  // can't accidentally pick it up.
  const scanResult = await scanBuffer(bytes, file.name);
  const targetDir =
    scanResult.status === "infected"
      ? path.join(QUARANTINE_DIR, matterId)
      : path.join(UPLOADS_DIR, matterId);
  if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });
  const storagePath = path.join(targetDir, `${id}-${file.name}`);
  await writeFile(storagePath, await encryptFile(bytes));

  const document: Document = {
    id,
    matterId,
    fileName: file.name,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    storagePath,
    contentHash,
    extractionStatus: null,
    extractionError: null,
    extractionCheckedAt: null,
    detectedLanguage: null,
    ocrConfidence: null,
    qualityScore: null,
    malwareScanStatus: scanResult.status,
    malwareScanDetail: scanResult.signature,
    parentDocumentId,
    sharedWithClient: 0,
    photoAnalysisStatus: null,
    photoAnalysisResult: null,
    photoAnalysisError: null,
    photoAnalyzedAt: null,
  };
  db.prepare(
    `INSERT INTO documents
       (id, matterId, fileName, sizeBytes, uploadedAt, storagePath, contentHash, malwareScanStatus, malwareScanDetail, parentDocumentId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    document.id,
    document.matterId,
    document.fileName,
    document.sizeBytes,
    document.uploadedAt,
    document.storagePath,
    document.contentHash,
    document.malwareScanStatus,
    document.malwareScanDetail,
    document.parentDocumentId,
  );

  if (scanResult.status === "infected") {
    await recordAuditEvent(
      "malware_detected",
      matterId,
      `Quarantined "${document.fileName}" — ClamAV flagged it as ${scanResult.signature}`,
    );
    return document;
  }

  const existingMatch = db
    .prepare(
      "SELECT fileName FROM documents WHERE matterId = ? AND contentHash = ? AND id != ? ORDER BY uploadedAt ASC LIMIT 1",
    )
    .get(matterId, contentHash, id) as unknown as { fileName: string } | undefined;

  if (existingMatch) {
    await recordAuditEvent(
      "duplicate_document_uploaded",
      matterId,
      `Uploaded "${document.fileName}", identical content to "${existingMatch.fileName}"`,
    );
  } else {
    await recordAuditEvent("document_uploaded", matterId, `Uploaded "${document.fileName}"`);
  }
  return document;
}

export function annotateDuplicates(
  documents: Document[],
): (Document & { duplicateOfFileName: string | null })[] {
  const firstSeenByHash = new Map<string, Document>();
  // Iterate oldest-first so the earliest upload per hash is treated as the original.
  for (const doc of [...documents].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))) {
    if (!firstSeenByHash.has(doc.contentHash)) firstSeenByHash.set(doc.contentHash, doc);
  }
  return documents.map((doc) => {
    const original = firstSeenByHash.get(doc.contentHash);
    return {
      ...doc,
      duplicateOfFileName: original && original.id !== doc.id ? original.fileName : null,
    };
  });
}

// Surfaces the email-attachment relationship (see emailImport.ts /
// parentDocumentId) the same way annotateDuplicates surfaces content
// duplicates — a display-only field the UI can badge, computed from the
// documents already in hand rather than a further query.
export function annotateAttachments<T extends Document>(
  documents: T[],
): (T & { parentFileName: string | null })[] {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  return documents.map((doc) => ({
    ...doc,
    parentFileName: doc.parentDocumentId ? byId.get(doc.parentDocumentId)?.fileName ?? null : null,
  }));
}

export async function listChatMessages(matterId: string): Promise<ChatMessage[]> {
  return db
    .prepare("SELECT * FROM chat_messages WHERE matterId = ? ORDER BY createdAt ASC")
    .all(matterId)
    .map((row) => toPlain<ChatMessage>(row));
}

export async function addChatMessage(
  matterId: string,
  role: ChatMessage["role"],
  content: string,
): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    matterId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO chat_messages (id, matterId, role, content, createdAt) VALUES (?, ?, ?, ?, ?)",
  ).run(message.id, message.matterId, message.role, message.content, message.createdAt);
  if (role === "user") {
    await recordAuditEvent("chat_question_asked", matterId, content.slice(0, 200));
  }
  return message;
}

export async function setMessageFeedback(
  chatMessageId: string,
  rating: MessageFeedback["rating"],
): Promise<MessageFeedback> {
  const newId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO message_feedback (id, chatMessageId, rating, createdAt) VALUES (?, ?, ?, ?)
     ON CONFLICT(chatMessageId) DO UPDATE SET rating = excluded.rating, createdAt = excluded.createdAt`,
  ).run(newId, chatMessageId, rating, createdAt);

  const owningMessage = db
    .prepare("SELECT matterId FROM chat_messages WHERE id = ?")
    .get(chatMessageId) as unknown as { matterId: string } | undefined;
  await recordAuditEvent(
    "chat_feedback_recorded",
    owningMessage?.matterId ?? null,
    `Marked an answer as ${rating === "up" ? "approved" : "flagged"}`,
  );

  const stored = db
    .prepare("SELECT * FROM message_feedback WHERE chatMessageId = ?")
    .get(chatMessageId);
  return toPlain<MessageFeedback>(stored);
}

export async function getFeedbackForMatter(
  matterId: string,
): Promise<Record<string, MessageFeedback["rating"]>> {
  const rows = db
    .prepare(
      `SELECT f.chatMessageId as chatMessageId, f.rating as rating
       FROM message_feedback f
       JOIN chat_messages m ON m.id = f.chatMessageId
       WHERE m.matterId = ?`,
    )
    .all(matterId) as unknown as { chatMessageId: string; rating: MessageFeedback["rating"] }[];

  return Object.fromEntries(rows.map((row) => [row.chatMessageId, row.rating]));
}

export async function listDigests(matterId: string): Promise<MatterDigest[]> {
  return db
    .prepare("SELECT * FROM matter_digests WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<MatterDigest>(row));
}

export async function addDigest(matterId: string, content: string): Promise<MatterDigest> {
  const digest: MatterDigest = {
    id: crypto.randomUUID(),
    matterId,
    content,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO matter_digests (id, matterId, content, createdAt) VALUES (?, ?, ?, ?)",
  ).run(digest.id, digest.matterId, digest.content, digest.createdAt);
  await recordAuditEvent("digest_generated", matterId, "Generated matter digest");
  return digest;
}

export async function listDeadlines(matterId: string): Promise<MatterDeadline[]> {
  return db
    .prepare(
      "SELECT * FROM matter_deadlines WHERE matterId = ? ORDER BY (dueDate IS NULL), dueDate ASC",
    )
    .all(matterId)
    .map((row) => toPlain<MatterDeadline>(row));
}

const DEADLINE_DESCRIPTION_MATCH_THRESHOLD = 0.7;

// Two deadlines count as the same real-world deadline if they share an
// exact due date (description wording is ignored entirely once dates
// agree — the AI can reword between extractions, e.g. "conference
// scheduled" vs. "scheduled at 10am", without it being a different
// deadline) or, when neither has a due date, if their descriptions are a
// close fuzzy match. Shared by dedupeExtractedDeadlines() (collapsing the
// same deadline mentioned in multiple source documents within one
// extraction) and checkForNewDeadlines()'s "already known" check
// (comparing a fresh extraction against what was already stored).
function isSameDeadline(
  a: { description: string; dueDate: string | null },
  b: { description: string; dueDate: string | null },
): boolean {
  if (a.dueDate && b.dueDate) return a.dueDate === b.dueDate;
  if (!a.dueDate && !b.dueDate) {
    return nameSimilarity(a.description, b.description) >= DEADLINE_DESCRIPTION_MATCH_THRESHOLD;
  }
  return false;
}

// The same real-world deadline is often mentioned in more than one source
// document with slightly different wording (a police report and a later
// memo both citing the same court date, say) — extractDeadlines() extracts
// per its full-context read and has no guarantee of merging those, so this
// collapses matches using isSameDeadline() above. Merges sourceDocument
// mentions from every duplicate into the kept row rather than discarding
// them.
// Despite DEADLINES_SCHEMA explicitly allowing a real JSON null for
// dueDate, the model occasionally emits the 4-character string "null"
// instead of the null literal for a date it couldn't resolve (caught live:
// a deadline description with an ambiguous date produced dueDate: "null",
// which then passed every "IS NOT NULL" filter downstream as if it were a
// real date and crashed date parsing in the calendar feed). Schema
// validation only checks JSON shape, not this kind of semantic mix-up, so
// it has to be normalized here before anything downstream treats it as a
// real value.
function normalizeExtractedDeadline(deadline: ExtractedDeadline): ExtractedDeadline {
  const isNullish = (v: string | null) => v === null || v.trim().toLowerCase() === "null" || v.trim() === "";
  return {
    ...deadline,
    dueDate: isNullish(deadline.dueDate) ? null : deadline.dueDate,
  };
}

function dedupeExtractedDeadlines(deadlines: ExtractedDeadline[]): ExtractedDeadline[] {
  const kept: ExtractedDeadline[] = [];
  for (const raw of deadlines) {
    const deadline = normalizeExtractedDeadline(raw);
    const match = kept.find((existing) => isSameDeadline(deadline, existing));
    if (match) {
      match.sourceDocument = mergeSourceDocument(match.sourceDocument, deadline.sourceDocument);
    } else {
      kept.push({ ...deadline });
    }
  }
  return kept;
}

// sourceDocument accumulates as a comma-joined list across repeated
// extractions (see replaceDeadlines) — must split each existing value back
// into its individual filenames before deduping, or a filename already
// present in the joined string gets re-appended as a "new" entry every
// time the AI cites it again, growing unboundedly instead of staying
// deduped.
function mergeSourceDocument(a: string | null, b: string | null): string | null {
  const split = (value: string | null) => (value ? value.split(", ") : []);
  const sources = new Set([...split(a), ...split(b)].filter(Boolean));
  return sources.size > 0 ? [...sources].join(", ") : null;
}

export async function replaceDeadlines(
  matterId: string,
  extracted: ExtractedDeadline[],
): Promise<MatterDeadline[]> {
  // extractDeadlines() re-derives the full list from the full document
  // corpus in one pass, so when it re-confirms a deadline it already
  // reported before, it typically only cites whichever single document
  // reads most naturally as "the source" to it in that pass — not every
  // document that actually mentions it. Carrying forward the
  // previously-stored sourceDocument and merging it in means attribution
  // accumulates across a matter's lifetime instead of narrowing to just
  // the latest extraction's pick.
  const existing = await listDeadlines(matterId);
  const deadlines = dedupeExtractedDeadlines(extracted).map((deadline) => {
    const match = existing.find((e) => isSameDeadline(deadline, e));
    return match
      ? { ...deadline, sourceDocument: mergeSourceDocument(match.sourceDocument, deadline.sourceDocument) }
      : deadline;
  });
  // Scoped to source='extracted' — a rule-computed or manually-added
  // deadline living in this same table must survive a re-extract, which
  // otherwise wipes and fully re-derives the list from scratch every time.
  db.prepare("DELETE FROM matter_deadlines WHERE matterId = ? AND source = 'extracted'").run(matterId);
  const createdAt = new Date().toISOString();
  const insert = db.prepare(
    "INSERT INTO matter_deadlines (id, matterId, description, dueDate, sourceDocument, source, createdAt) VALUES (?, ?, ?, ?, ?, 'extracted', ?)",
  );
  for (const deadline of deadlines) {
    insert.run(
      crypto.randomUUID(),
      matterId,
      deadline.description,
      deadline.dueDate,
      deadline.sourceDocument,
      createdAt,
    );
  }
  await recordAuditEvent(
    "deadlines_extracted",
    matterId,
    `Extracted ${deadlines.length} deadline(s)`,
  );
  return listDeadlines(matterId);
}

// Deadline-monitoring agent: instead of only re-checking when a lawyer
// remembers to click "re-extract", this runs automatically right after new
// documents land in a matter (single upload, bulk zip import, email
// import — see the callers). Not a tool-calling loop like the drafting
// agent; the "agentic" property here is autonomous triggering, not tool
// use — a new document appearing is the trigger, no human click needed.
// extractDeadlines() re-derives the full current list from all of a
// matter's documents every time (same as the manual button always did,
// not an incremental append) — this wrapper's only addition is diffing
// against what was already stored, so a caller can say "N new deadline(s)
// found" rather than just "deadlines refreshed."
function isKnownDeadline(candidate: MatterDeadline, before: MatterDeadline[]): boolean {
  return before.some((b) => isSameDeadline(candidate, b));
}

export async function checkForNewDeadlines(
  matterId: string,
): Promise<{ deadlines: MatterDeadline[]; newCount: number }> {
  const before = await listDeadlines(matterId);

  const sections = await getMatterDocumentSections(matterId);
  const extracted = await extractDeadlines(sections);
  const deadlines = await replaceDeadlines(matterId, extracted);

  const newCount = deadlines.filter((d) => !isKnownDeadline(d, before)).length;
  return { deadlines, newCount };
}

export interface ClassificationSuggestion {
  classification: MatterClassification;
  reason: string;
}

// Intake agent: suggests tightening a matter's classification based on its
// documents' content, right after new documents arrive — never applied
// automatically, just surfaced for the lawyer to accept or dismiss (see
// suggestMatterClassification() in claude.ts). Only runs while a matter
// is still at the "standard" default; once a lawyer has classified it
// (accepting a suggestion or setting it manually), this stops
// second-guessing that decision on every subsequent upload.
export async function checkMatterClassification(
  matterId: string,
): Promise<ClassificationSuggestion | null> {
  const matter = await getMatter(matterId);
  if (!matter || matter.classification !== "standard") return null;

  const context = await getMatterTextContext(matterId);
  if (!context) return null;

  const { classification, reason } = await suggestMatterClassification(context);
  return classification === "standard" ? null : { classification, reason };
}

// For the calendar subscription feed (icsExport.ts) — every deadline with
// a due date, not just the next few, since a subscribed calendar feed is
// meant to be the complete picture rather than a dashboard preview. Capped
// generously rather than truly unbounded, just as a sanity limit.
export async function listAllDeadlinesForFeed(): Promise<(MatterDeadline & { matterTitle: string })[]> {
  return db
    .prepare(
      `SELECT d.*, m.title as matterTitle
       FROM matter_deadlines d
       JOIN matters m ON m.id = d.matterId
       WHERE d.dueDate IS NOT NULL
       ORDER BY d.dueDate ASC
       LIMIT 2000`,
    )
    .all()
    .map((row) => toPlain<MatterDeadline & { matterTitle: string }>(row));
}

export async function listUpcomingDeadlines(limit = 10): Promise<(MatterDeadline & { matterTitle: string })[]> {
  return db
    .prepare(
      `SELECT d.*, m.title as matterTitle
       FROM matter_deadlines d
       JOIN matters m ON m.id = d.matterId
       WHERE d.dueDate IS NOT NULL
       ORDER BY d.dueDate ASC
       LIMIT ?`,
    )
    .all(limit)
    .map((row) => toPlain<MatterDeadline & { matterTitle: string }>(row));
}

export async function listDrafts(matterId: string): Promise<Draft[]> {
  return db
    .prepare("SELECT * FROM drafts WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<Draft>(row));
}

export async function addDraft(
  matterId: string,
  draftType: DraftType,
  content: string,
): Promise<Draft> {
  const draft: Draft = {
    id: crypto.randomUUID(),
    matterId,
    draftType,
    content,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO drafts (id, matterId, draftType, content, createdAt) VALUES (?, ?, ?, ?, ?)",
  ).run(draft.id, draft.matterId, draft.draftType, draft.content, draft.createdAt);
  await recordAuditEvent("draft_generated", matterId, `Generated ${draftType} draft`);
  return draft;
}

export async function listEvidenceMatrices(matterId: string): Promise<EvidenceMatrix[]> {
  return db
    .prepare("SELECT * FROM evidence_matrices WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<EvidenceMatrix>(row));
}

export async function addEvidenceMatrix(matterId: string, content: string): Promise<EvidenceMatrix> {
  const matrix: EvidenceMatrix = {
    id: crypto.randomUUID(),
    matterId,
    content,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO evidence_matrices (id, matterId, content, createdAt) VALUES (?, ?, ?, ?)",
  ).run(matrix.id, matrix.matterId, matrix.content, matrix.createdAt);
  await recordAuditEvent("evidence_matrix_generated", matterId, "Generated evidence matrix");
  return matrix;
}

export interface SimpleGeneratedDoc {
  id: string;
  matterId: string;
  content: string;
  createdAt: string;
}

// Shared read/write for the four new analysis tables added alongside
// digest/evidence-matrix — all identical in shape (one markdown blob per
// generation, append-only), so this avoids four near-identical
// hand-written CRUD implementations. digest/evidence-matrix keep their own
// dedicated functions above rather than being retrofitted onto this — not
// broken, no reason to touch them just for consistency.
function listSimpleGeneratedDocs(table: string, matterId: string): SimpleGeneratedDoc[] {
  return db
    .prepare(`SELECT * FROM ${table} WHERE matterId = ? ORDER BY createdAt DESC`)
    .all(matterId)
    .map((row) => toPlain<SimpleGeneratedDoc>(row));
}

async function addSimpleGeneratedDoc(
  table: string,
  matterId: string,
  content: string,
  auditAction: string,
  auditDetail: string,
): Promise<SimpleGeneratedDoc> {
  const doc: SimpleGeneratedDoc = {
    id: crypto.randomUUID(),
    matterId,
    content,
    createdAt: new Date().toISOString(),
  };
  db.prepare(`INSERT INTO ${table} (id, matterId, content, createdAt) VALUES (?, ?, ?, ?)`).run(
    doc.id,
    doc.matterId,
    doc.content,
    doc.createdAt,
  );
  await recordAuditEvent(auditAction, matterId, auditDetail);
  return doc;
}

export async function listContradictionAnalyses(matterId: string): Promise<SimpleGeneratedDoc[]> {
  return listSimpleGeneratedDocs("contradiction_analyses", matterId);
}
export async function addContradictionAnalysis(matterId: string, content: string): Promise<SimpleGeneratedDoc> {
  return addSimpleGeneratedDoc(
    "contradiction_analyses",
    matterId,
    content,
    "contradiction_analysis_generated",
    "Generated a contradiction/witness-comparison analysis",
  );
}

export async function listExhibitLists(matterId: string): Promise<SimpleGeneratedDoc[]> {
  return listSimpleGeneratedDocs("exhibit_lists", matterId);
}
export async function addExhibitList(matterId: string, content: string): Promise<SimpleGeneratedDoc> {
  return addSimpleGeneratedDoc("exhibit_lists", matterId, content, "exhibit_list_generated", "Generated an exhibit list");
}

export async function listDisclosureChecklists(matterId: string): Promise<SimpleGeneratedDoc[]> {
  return listSimpleGeneratedDocs("disclosure_checklists", matterId);
}
export async function addDisclosureChecklist(matterId: string, content: string): Promise<SimpleGeneratedDoc> {
  return addSimpleGeneratedDoc(
    "disclosure_checklists",
    matterId,
    content,
    "disclosure_checklist_generated",
    "Generated a disclosure-completeness checklist",
  );
}

export async function listCrownPositionAnalyses(matterId: string): Promise<SimpleGeneratedDoc[]> {
  return listSimpleGeneratedDocs("crown_position_analyses", matterId);
}
export async function addCrownPositionAnalysis(matterId: string, content: string): Promise<SimpleGeneratedDoc> {
  return addSimpleGeneratedDoc(
    "crown_position_analyses",
    matterId,
    content,
    "crown_position_analysis_generated",
    "Generated a Crown-position analysis",
  );
}

export async function listPrivilegeReviews(matterId: string): Promise<SimpleGeneratedDoc[]> {
  return listSimpleGeneratedDocs("privilege_reviews", matterId);
}
export async function addPrivilegeReview(matterId: string, content: string): Promise<SimpleGeneratedDoc> {
  return addSimpleGeneratedDoc(
    "privilege_reviews",
    matterId,
    content,
    "privilege_review_generated",
    "Generated a privilege & redaction review",
  );
}

export async function listRedlineAnalyses(matterId: string): Promise<SimpleGeneratedDoc[]> {
  return listSimpleGeneratedDocs("redline_analyses", matterId);
}
export async function addRedlineAnalysis(matterId: string, content: string): Promise<SimpleGeneratedDoc> {
  return addSimpleGeneratedDoc(
    "redline_analyses",
    matterId,
    content,
    "redline_analysis_generated",
    "Generated a contract redline against the firm's clause library",
  );
}

export async function listMissingEvidenceReports(matterId: string): Promise<SimpleGeneratedDoc[]> {
  return listSimpleGeneratedDocs("missing_evidence_reports", matterId);
}
export async function addMissingEvidenceReport(matterId: string, content: string): Promise<SimpleGeneratedDoc> {
  return addSimpleGeneratedDoc(
    "missing_evidence_reports",
    matterId,
    content,
    "missing_evidence_report_generated",
    "Generated a missing-evidence rollup",
  );
}

// Gathers whichever of digest/disclosure-checklist/evidence-matrix/crown-
// position have been generated for this matter so far — the route checks
// emptiness itself (same pattern as evidence-graph/route.ts's "no matrix
// yet" check) before calling generateMissingEvidenceReport below.
export async function getMissingEvidenceSources(
  matterId: string,
): Promise<{ label: string; content: string }[]> {
  const [digests, checklists, matrices, crownPositions] = await Promise.all([
    listDigests(matterId),
    listDisclosureChecklists(matterId),
    listEvidenceMatrices(matterId),
    listCrownPositionAnalyses(matterId),
  ]);

  return [
    digests[0] && { label: "Digest", content: digests[0].content },
    checklists[0] && { label: "Disclosure checklist", content: checklists[0].content },
    matrices[0] && { label: "Evidence matrix", content: matrices[0].content },
    crownPositions[0] && { label: "Crown position", content: crownPositions[0].content },
  ].filter((s): s is { label: string; content: string } => Boolean(s));
}

// Rolls up the "missing"/"gap" items already flagged across whichever
// analyses getMissingEvidenceSources found.
export async function generateMissingEvidenceReport(
  matterId: string,
  sources: { label: string; content: string }[],
): Promise<SimpleGeneratedDoc> {
  const { items } = await extractMissingEvidenceItems(sources);

  const bySource = new Map<string, string[]>();
  for (const item of items) {
    const existing = bySource.get(item.source) ?? [];
    existing.push(item.description);
    bySource.set(item.source, existing);
  }

  const content =
    bySource.size === 0
      ? "No missing documents or evidentiary gaps are currently flagged across the generated analyses."
      : [...bySource.entries()]
          .map(([source, descriptions]) => `## From ${source}\n${descriptions.map((d) => `- ${d}`).join("\n")}`)
          .join("\n\n");

  return addMissingEvidenceReport(matterId, content);
}

export async function listIndependentReviews(matterId: string): Promise<IndependentReview[]> {
  return db
    .prepare("SELECT * FROM independent_reviews WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<IndependentReview>(row));
}

export async function addIndependentReview(
  matterId: string,
  sourceType: IndependentReview["sourceType"],
  sourceId: string,
  content: string,
): Promise<IndependentReview> {
  const review: IndependentReview = {
    id: crypto.randomUUID(),
    matterId,
    sourceType,
    sourceId,
    content,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO independent_reviews (id, matterId, sourceType, sourceId, content, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(review.id, review.matterId, review.sourceType, review.sourceId, review.content, review.createdAt);
  await recordAuditEvent("independent_review_generated", matterId, "Generated independent review");
  return review;
}

export async function listTimeEntries(matterId: string): Promise<TimeEntry[]> {
  return db
    .prepare("SELECT * FROM time_entries WHERE matterId = ? ORDER BY workedOn DESC, createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<TimeEntry>(row));
}

export async function addTimeEntry(
  matterId: string,
  input: { workedOn: string; description: string; hours: number; rate?: number | null; userId?: string | null },
): Promise<TimeEntry> {
  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    matterId,
    workedOn: input.workedOn,
    description: input.description,
    hours: input.hours,
    rate: input.rate ?? null,
    invoiceId: null,
    userId: input.userId ?? null,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO time_entries (id, matterId, workedOn, description, hours, rate, invoiceId, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    entry.id,
    entry.matterId,
    entry.workedOn,
    entry.description,
    entry.hours,
    entry.rate,
    entry.invoiceId,
    entry.userId,
    entry.createdAt,
  );
  await recordAuditEvent(
    "time_entry_logged",
    matterId,
    `Logged ${entry.hours}h on ${entry.workedOn}: ${entry.description}`,
  );
  return entry;
}

export async function deleteTimeEntry(matterId: string, entryId: string): Promise<void> {
  const entry = db
    .prepare("SELECT invoiceId FROM time_entries WHERE id = ? AND matterId = ?")
    .get(entryId, matterId) as unknown as { invoiceId: string | null } | undefined;
  if (entry?.invoiceId) {
    throw new Error("This time entry has already been invoiced and can't be deleted.");
  }
  db.prepare("DELETE FROM time_entries WHERE id = ? AND matterId = ?").run(entryId, matterId);
  await recordAuditEvent("time_entry_deleted", matterId, "Deleted a time entry");
}

function generateInvoiceNumber(issuedAt: string): string {
  const year = issuedAt.slice(0, 4);
  const { count } = db
    .prepare("SELECT COUNT(*) as count FROM invoices WHERE invoiceNumber LIKE ?")
    .get(`INV-${year}-%`) as { count: number };
  return `INV-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function listUnbilledTimeEntries(matterId: string): Promise<TimeEntry[]> {
  return db
    .prepare(
      "SELECT * FROM time_entries WHERE matterId = ? AND invoiceId IS NULL ORDER BY workedOn ASC",
    )
    .all(matterId)
    .map((row) => toPlain<TimeEntry>(row));
}

export async function listInvoices(matterId: string): Promise<Invoice[]> {
  return db
    .prepare("SELECT * FROM invoices WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<Invoice>(row));
}

export async function listInvoiceEntries(invoiceId: string): Promise<TimeEntry[]> {
  return db
    .prepare("SELECT * FROM time_entries WHERE invoiceId = ? ORDER BY workedOn ASC")
    .all(invoiceId)
    .map((row) => toPlain<TimeEntry>(row));
}

export async function createInvoice(
  matterId: string,
  input: { entryIds: string[]; disbursementIds?: string[]; hourlyRate: number; discount: number },
): Promise<Invoice> {
  if (input.entryIds.length === 0) {
    throw new Error("Select at least one time entry to invoice.");
  }

  const placeholders = input.entryIds.map(() => "?").join(",");
  const entries = db
    .prepare(
      `SELECT * FROM time_entries WHERE matterId = ? AND invoiceId IS NULL AND id IN (${placeholders})`,
    )
    .all(matterId, ...input.entryIds) as unknown as TimeEntry[];

  if (entries.length !== input.entryIds.length) {
    throw new Error("Some selected time entries are invalid or already invoiced.");
  }

  const disbursementIds = input.disbursementIds ?? [];
  let disbursements: Disbursement[] = [];
  if (disbursementIds.length > 0) {
    const dPlaceholders = disbursementIds.map(() => "?").join(",");
    disbursements = db
      .prepare(
        `SELECT * FROM disbursements WHERE matterId = ? AND invoiceId IS NULL AND id IN (${dPlaceholders})`,
      )
      .all(matterId, ...disbursementIds) as unknown as Disbursement[];
    if (disbursements.length !== disbursementIds.length) {
      throw new Error("Some selected disbursements are invalid or already invoiced.");
    }
  }

  const hours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const subtotal = hours * input.hourlyRate;
  const disbursementsTotal = disbursements.reduce((sum, d) => sum + d.amount, 0);
  const total = Math.max(0, subtotal + disbursementsTotal - input.discount);
  const createdAt = new Date().toISOString();

  const invoice: Invoice = {
    id: crypto.randomUUID(),
    matterId,
    invoiceNumber: generateInvoiceNumber(createdAt),
    hourlyRate: input.hourlyRate,
    hours,
    subtotal,
    discount: input.discount,
    total,
    status: "unpaid",
    paidAt: null,
    createdAt,
    signableDocumentId: null,
    disbursementsTotal,
  };

  db.prepare(
    `INSERT INTO invoices (id, matterId, invoiceNumber, hourlyRate, hours, subtotal, discount, total, status, paidAt, createdAt, disbursementsTotal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    invoice.id,
    invoice.matterId,
    invoice.invoiceNumber,
    invoice.hourlyRate,
    invoice.hours,
    invoice.subtotal,
    invoice.discount,
    invoice.total,
    invoice.status,
    invoice.paidAt,
    invoice.createdAt,
    invoice.disbursementsTotal,
  );

  const markBilled = db.prepare("UPDATE time_entries SET invoiceId = ? WHERE id = ?");
  for (const entryId of input.entryIds) {
    markBilled.run(invoice.id, entryId);
  }
  const markDisbursementsBilled = db.prepare("UPDATE disbursements SET invoiceId = ? WHERE id = ?");
  for (const disbursementId of disbursementIds) {
    markDisbursementsBilled.run(invoice.id, disbursementId);
  }

  await recordAuditEvent(
    "invoice_created",
    matterId,
    `Created invoice ${invoice.invoiceNumber} for ${hours.toFixed(1)}h${
      disbursementsTotal > 0 ? ` + $${disbursementsTotal.toFixed(2)} disbursements` : ""
    } ($${total.toFixed(2)})`,
  );

  return invoice;
}

export async function getInvoice(matterId: string, invoiceId: string): Promise<Invoice | null> {
  const row = db
    .prepare("SELECT * FROM invoices WHERE id = ? AND matterId = ?")
    .get(invoiceId, matterId);
  return row ? toPlain<Invoice>(row) : null;
}

// Requests explicit client approval of an invoice via the same e-signature
// mechanism used for consent documents, rather than a separate approval
// flow. Reissues a fresh link on repeat calls (safe — sendForSignature
// revokes the prior token); throws if the client has already approved it,
// since re-sending a signed document makes no sense.
export async function requestInvoiceApproval(
  matterId: string,
  invoiceId: string,
  createdByUserId: string | null,
  baseUrl?: string,
): Promise<{ invoice: Invoice; signUrl: string | null; emailedTo: string | null; docusignEnvelopeId: string | null }> {
  const invoice = await getInvoice(matterId, invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  let signableDocumentId = invoice.signableDocumentId;
  if (!signableDocumentId) {
    const signable = await createSignableDocument(
      matterId,
      "custom",
      `Invoice ${invoice.invoiceNumber} approval`,
      null,
      createdByUserId,
    );
    signableDocumentId = signable.id;
    db.prepare("UPDATE invoices SET signableDocumentId = ? WHERE id = ?").run(signableDocumentId, invoiceId);
  } else {
    const existing = await getSignableDocument(signableDocumentId);
    if (existing?.status === "signed") {
      throw new Error("The client has already approved this invoice.");
    }
  }

  const { token, emailedTo, docusignEnvelopeId } = await sendForSignature(signableDocumentId, createdByUserId, baseUrl);
  const updated = await getInvoice(matterId, invoiceId);
  return { invoice: updated!, signUrl: token ? `/sign/${token}` : null, emailedTo, docusignEnvelopeId };
}

export async function recordInvoiceSent(matterId: string, invoiceNumber: string, to: string): Promise<void> {
  await recordAuditEvent("invoice_sent", matterId, `Emailed invoice ${invoiceNumber} to ${to}`);
}

export async function recordMatterEmailSent(
  matterId: string,
  to: string,
  subject: string,
  attachedFileNames: string[] = [],
): Promise<void> {
  const attachmentDetail =
    attachedFileNames.length > 0
      ? ` with ${attachedFileNames.length} attachment${attachedFileNames.length === 1 ? "" : "s"} (${attachedFileNames.join(", ")})`
      : "";
  await recordAuditEvent("matter_email_sent", matterId, `Emailed ${to}: "${subject}"${attachmentDetail}`);
}

export async function updateInvoiceStatus(
  matterId: string,
  invoiceId: string,
  status: Invoice["status"],
): Promise<Invoice | null> {
  const paidAt = status === "paid" ? new Date().toISOString() : null;
  db.prepare("UPDATE invoices SET status = ?, paidAt = ? WHERE id = ? AND matterId = ?").run(
    status,
    paidAt,
    invoiceId,
    matterId,
  );
  const row = db
    .prepare("SELECT * FROM invoices WHERE id = ? AND matterId = ?")
    .get(invoiceId, matterId);
  if (!row) return null;
  await recordAuditEvent(
    status === "paid" ? "invoice_marked_paid" : "invoice_marked_unpaid",
    matterId,
    `Marked invoice as ${status}`,
  );
  return toPlain<Invoice>(row);
}

export async function listMatterNotes(matterId: string): Promise<MatterNote[]> {
  return db
    .prepare("SELECT * FROM matter_notes WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<MatterNote>(row));
}

export async function addMatterNote(matterId: string, content: string): Promise<MatterNote> {
  const note: MatterNote = {
    id: crypto.randomUUID(),
    matterId,
    content,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO matter_notes (id, matterId, content, createdAt) VALUES (?, ?, ?, ?)",
  ).run(note.id, note.matterId, note.content, note.createdAt);
  await recordAuditEvent("matter_note_added", matterId, "Added a note");
  return note;
}

export async function deleteMatterNote(matterId: string, noteId: string): Promise<void> {
  db.prepare("DELETE FROM matter_notes WHERE id = ? AND matterId = ?").run(noteId, matterId);
}

export interface MatterDocumentSection {
  label: string;
  text: string;
}

// Per-document breakdown of everything getMatterTextContext used to
// concatenate directly — split out so callers that need comprehensive
// coverage but can't fit it all in one AI call (see buildMatterContext in
// claude.ts) can summarize document-by-document instead of only ever
// having one giant pre-joined string to work with. Each section's text is
// already PII-masked, so every caller gets that for free.
export async function getMatterDocumentSections(matterId: string): Promise<MatterDocumentSection[]> {
  const documents = await listDocuments(matterId);
  const extractable = documents.filter((doc) => isSafeToExtract(doc));

  const docSections = await Promise.all(
    extractable.map(async (doc) => {
      const text = await extractTextTracked("documents", doc.id, doc.fileName, doc.storagePath);
      return {
        label: doc.fileName,
        text: await maskForAI(text ?? "[Could not extract text from this file]"),
      };
    }),
  );

  const referenceDocs = await listAttachedReferenceDocuments(matterId);
  const referenceSections = await Promise.all(
    referenceDocs
      .filter((doc) => isSafeToExtract(doc))
      .map(async (doc) => {
        const text = await extractTextTracked(
          "reference_documents",
          doc.id,
          doc.fileName,
          doc.storagePath,
        );
        return {
          label: `Reference: ${doc.fileName}`,
          text: await maskForAI(text ?? "[Could not extract text from this file]"),
        };
      }),
  );

  const notes = await listMatterNotes(matterId);
  const noteSections =
    notes.length > 0
      ? [
          {
            label: "Lawyer's notes",
            text: await maskForAI(
              notes.map((n) => `[${n.createdAt.slice(0, 10)}] ${n.content}`).join("\n\n"),
            ),
          },
        ]
      : [];

  return [...docSections, ...referenceSections, ...noteSections];
}

export async function getMatterTextContext(matterId: string): Promise<string> {
  const sections = await getMatterDocumentSections(matterId);
  return sections.map((s) => `--- ${s.label} ---\n${s.text}`).join("\n\n");
}

// Chat context, built via retrieval instead of concatenating every document
// in full — see rag.ts. Digest/evidence-matrix/deadlines/drafts still use
// getMatterTextContext above: those need comprehensive coverage of every
// document to summarize correctly, not "the parts most similar to a
// query" (there isn't a query for "summarize everything"). Chat is
// specifically query-driven, which is what makes retrieval the right fit
// there and not elsewhere.
export async function getMatterChatContext(matterId: string, question: string): Promise<string> {
  const documents = await listDocuments(matterId);
  const extractable = documents.filter((doc) => isSafeToExtract(doc));
  const docResults = await Promise.all(
    extractable.map(async (doc) => ({ fileName: doc.fileName, result: await ensureDocumentChunks(doc) })),
  );

  const referenceDocs = await listAttachedReferenceDocuments(matterId);
  const refResults = await Promise.all(
    referenceDocs
      .filter((doc) => isSafeToExtract(doc))
      .map(async (doc) => ({
        fileName: doc.fileName,
        result: await ensureReferenceDocumentChunks(doc),
      })),
  );

  const unreadable = [...docResults, ...refResults]
    .filter((r) => r.result === "unreadable")
    .map((r) => r.fileName);
  const unreadableSection =
    unreadable.length > 0
      ? `--- Could not extract text from these uploaded files: ${unreadable.join(", ")} ---`
      : null;

  const relevantChunks = await getRelevantChunks(matterId, question);
  const chunkContext = buildContextFromChunks(relevantChunks);
  const confidenceSection = buildRetrievalConfidenceNote(relevantChunks);

  const notes = await listMatterNotes(matterId);
  const notesSection =
    notes.length > 0
      ? `--- Lawyer's notes ---\n${notes
          .map((n) => `[${n.createdAt.slice(0, 10)}] ${n.content}`)
          .join("\n\n")}`
      : null;

  const context = [chunkContext, confidenceSection, unreadableSection, notesSection]
    .filter(Boolean)
    .join("\n\n");
  return maskForAI(context);
}

export interface SimilarDocument {
  id: string;
  kind: "document" | "reference";
  fileName: string;
  score: number;
}

function centroidEmbedding(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += vector[i];
  }
  return sum.map((total) => total / vectors.length);
}

// Similarity is scoped to one matter, deliberately — comparing across
// matters would mean an embedding derived from one client's confidential
// document influencing what's shown for another, which is exactly the
// cross-matter leakage this app's design otherwise avoids. Includes
// reference-library documents attached to the matter, since those are
// already part of what this matter can see. Each document's embedding is
// the centroid (average) of its own chunk embeddings, since a document can
// have many chunks but similarity is naturally a per-document notion here.
export async function getSimilarDocuments(
  matterId: string,
  documentId: string,
  topK = 5,
): Promise<SimilarDocument[]> {
  const documents = await listDocuments(matterId);
  const extractable = documents.filter((doc) => isSafeToExtract(doc));
  await Promise.all(extractable.map((doc) => ensureDocumentChunks(doc)));

  const referenceDocs = await listAttachedReferenceDocuments(matterId);
  await Promise.all(
    referenceDocs
      .filter((doc) => isSafeToExtract(doc))
      .map((doc) => ensureReferenceDocumentChunks(doc)),
  );

  const rows = db
    .prepare(
      `SELECT documentId, referenceDocumentId, fileName, embedding FROM document_chunks
       WHERE matterId = ?
          OR referenceDocumentId IN (
            SELECT referenceDocumentId FROM matter_reference_documents WHERE matterId = ?
          )`,
    )
    .all(matterId, matterId)
    .map((row) =>
      toPlain<{
        documentId: string | null;
        referenceDocumentId: string | null;
        fileName: string;
        embedding: string;
      }>(row),
    );

  const groups = new Map<string, { kind: "document" | "reference"; fileName: string; vectors: number[][] }>();
  for (const row of rows) {
    const key = row.documentId ? `document:${row.documentId}` : `reference:${row.referenceDocumentId}`;
    const group = groups.get(key) ?? {
      kind: row.documentId ? ("document" as const) : ("reference" as const),
      fileName: row.fileName,
      vectors: [],
    };
    group.vectors.push(JSON.parse(row.embedding) as number[]);
    groups.set(key, group);
  }

  const sourceGroup = groups.get(`document:${documentId}`);
  if (!sourceGroup || sourceGroup.vectors.length === 0) return [];
  const sourceCentroid = centroidEmbedding(sourceGroup.vectors);

  const scored: SimilarDocument[] = [];
  for (const [key, group] of groups) {
    if (key === `document:${documentId}`) continue;
    scored.push({
      id: key.slice(key.indexOf(":") + 1),
      kind: group.kind,
      fileName: group.fileName,
      score: cosineSimilarity(sourceCentroid, centroidEmbedding(group.vectors)),
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// High on purpose: two documents about the same matter easily share 0.8-0.9
// cosine similarity just from overlapping legal boilerplate/subject matter.
// This threshold is meant to catch near-identical content (a re-scanned copy,
// a reformatted version of the same letter) — not "related", which is what
// getSimilarDocuments above is for. Tune if real usage shows false positives
// or misses.
const NEAR_DUPLICATE_THRESHOLD = 0.96;

// Only matter-owned documents (not reference-library material) — near-duplicate
// detection is about catching the same disclosure landing twice, not flagging
// a matter document for resembling a statute it cites.
async function getDocumentCentroids(matterId: string): Promise<Map<string, { fileName: string; centroid: number[] }>> {
  const rows = db
    .prepare(
      "SELECT documentId, fileName, embedding FROM document_chunks WHERE matterId = ? AND documentId IS NOT NULL",
    )
    .all(matterId)
    .map((row) => toPlain<{ documentId: string; fileName: string; embedding: string }>(row));

  const vectorsByDocument = new Map<string, { fileName: string; vectors: number[][] }>();
  for (const row of rows) {
    const group = vectorsByDocument.get(row.documentId) ?? { fileName: row.fileName, vectors: [] };
    group.vectors.push(JSON.parse(row.embedding) as number[]);
    vectorsByDocument.set(row.documentId, group);
  }

  const centroids = new Map<string, { fileName: string; centroid: number[] }>();
  for (const [documentId, group] of vectorsByDocument) {
    centroids.set(documentId, { fileName: group.fileName, centroid: centroidEmbedding(group.vectors) });
  }
  return centroids;
}

function bestNearDuplicateMatch(
  centroids: Map<string, { fileName: string; centroid: number[] }>,
  documentId: string,
): { fileName: string; score: number } | null {
  const source = centroids.get(documentId);
  if (!source) return null;

  let best: { fileName: string; score: number } | null = null;
  for (const [otherId, other] of centroids) {
    if (otherId === documentId) continue;
    const score = cosineSimilarity(source.centroid, other.centroid);
    if (score >= NEAR_DUPLICATE_THRESHOLD && (!best || score > best.score)) {
      best = { fileName: other.fileName, score };
    }
  }
  return best;
}

// Called right after upload (best-effort, same as the deadline/classification
// checks) — forces chunking/embedding of the new document (and any other
// not-yet-chunked matter documents) so the check has real vectors to compare,
// rather than only working once something else (chat, "Similar") happens to
// have triggered chunking first.
export async function checkNearDuplicateOnUpload(
  matterId: string,
  documentId: string,
): Promise<{ fileName: string; score: number } | null> {
  const documents = await listDocuments(matterId);
  const extractable = documents.filter((doc) => isSafeToExtract(doc));
  await Promise.all(extractable.map((doc) => ensureDocumentChunks(doc)));

  const centroids = await getDocumentCentroids(matterId);
  const match = bestNearDuplicateMatch(centroids, documentId);
  if (match) {
    await recordAuditEvent(
      "near_duplicate_document_detected",
      matterId,
      `"${documents.find((d) => d.id === documentId)?.fileName}" is a near-duplicate (${Math.round(match.score * 100)}% similar) of "${match.fileName}"`,
    );
  }
  return match;
}

// For rendering the documents list: only uses embeddings already cached in
// document_chunks (no embedding-API calls just to load a page) — documents
// that haven't been chunked yet by any other feature simply show no
// near-duplicate badge yet, the same lazy-until-needed tradeoff the rest of
// this app's chunking makes. Skips a document already flagged as an exact
// (hash) duplicate so the two badges don't both show for the same file.
export async function annotateNearDuplicates<T extends Document & { duplicateOfFileName?: string | null }>(
  matterId: string,
  documents: T[],
): Promise<(T & { nearDuplicateOfFileName: string | null; nearDuplicateScore: number | null })[]> {
  const centroids = await getDocumentCentroids(matterId);
  return documents.map((doc) => {
    if (doc.duplicateOfFileName) {
      return { ...doc, nearDuplicateOfFileName: null, nearDuplicateScore: null };
    }
    const match = bestNearDuplicateMatch(centroids, doc.id);
    return {
      ...doc,
      nearDuplicateOfFileName: match?.fileName ?? null,
      nearDuplicateScore: match?.score ?? null,
    };
  });
}
