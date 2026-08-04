import { mkdir, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";
import { recordAuditEvent } from "./auditLog";
import { encryptFile } from "./crypto";
import db, { toPlain } from "./db";
import { listAttachedReferenceDocuments } from "./referenceLibrary";
import {
  buildContextFromChunks,
  ensureDocumentChunks,
  ensureReferenceDocumentChunks,
  getRelevantChunks,
} from "./rag";
import { extractDocumentText, isExtractableDocument } from "./textExtraction";
import type { ExtractedDeadline } from "./claude";
import type {
  ChatMessage,
  Document,
  Draft,
  DraftType,
  EvidenceMatrix,
  IndependentReview,
  Invoice,
  Matter,
  MatterDeadline,
  MatterDigest,
  MatterNote,
  MessageFeedback,
  TimeEntry,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

export async function listMatters(): Promise<Matter[]> {
  return db
    .prepare("SELECT * FROM matters ORDER BY createdAt DESC")
    .all()
    .map((row) => toPlain<Matter>(row));
}

export async function getMatter(id: string): Promise<Matter | null> {
  const row = db.prepare("SELECT * FROM matters WHERE id = ?").get(id);
  return row ? toPlain<Matter>(row) : null;
}

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
}

export async function checkConflicts(clientName: string): Promise<ConflictMatch[]> {
  const trimmed = clientName.trim();
  if (!trimmed) return [];
  const rows = db
    .prepare("SELECT id, title, fileNumber, clientName FROM matters WHERE clientName LIKE ?")
    .all(`%${trimmed}%`) as { id: string; title: string; fileNumber: string; clientName: string }[];
  return rows.map((row) => ({
    matterId: row.id,
    matterTitle: row.title,
    fileNumber: row.fileNumber,
    matchedOn: row.clientName,
  }));
}

export async function createMatter(input: {
  title: string;
  clientName: string;
  clientEmail?: string;
  matterType: string;
  hourlyRate?: number;
}): Promise<Matter> {
  const createdAt = new Date().toISOString();
  const matter: Matter = {
    id: crypto.randomUUID(),
    fileNumber: generateFileNumber(createdAt),
    title: input.title,
    clientName: input.clientName,
    clientEmail: input.clientEmail?.trim() || null,
    matterType: input.matterType,
    status: "open",
    hourlyRate: input.hourlyRate ?? null,
    classification: "standard",
    legalHold: 0,
    legalHoldReason: null,
    retentionDate: null,
    createdAt,
  };
  db.prepare(
    "INSERT INTO matters (id, fileNumber, title, clientName, clientEmail, matterType, status, hourlyRate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    matter.id,
    matter.fileNumber,
    matter.title,
    matter.clientName,
    matter.clientEmail,
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
  return matter;
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
  db.prepare("DELETE FROM documents WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM matter_digests WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM matter_deadlines WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM drafts WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM evidence_matrices WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM independent_reviews WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM invoices WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM time_entries WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM matter_notes WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM matter_reference_documents WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM audit_log WHERE matterId = ?").run(matterId);
  db.prepare("DELETE FROM matters WHERE id = ?").run(matterId);

  const matterDir = path.join(UPLOADS_DIR, matterId);
  if (existsSync(matterDir)) {
    await rm(matterDir, { recursive: true, force: true });
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

export async function addDocument(
  matterId: string,
  file: File,
): Promise<Document> {
  const matterDir = path.join(UPLOADS_DIR, matterId);
  if (!existsSync(matterDir)) await mkdir(matterDir, { recursive: true });

  const id = crypto.randomUUID();
  const storagePath = path.join(matterDir, `${id}-${file.name}`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  await writeFile(storagePath, await encryptFile(bytes));

  const document: Document = {
    id,
    matterId,
    fileName: file.name,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    storagePath,
    contentHash,
  };
  db.prepare(
    "INSERT INTO documents (id, matterId, fileName, sizeBytes, uploadedAt, storagePath, contentHash) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    document.id,
    document.matterId,
    document.fileName,
    document.sizeBytes,
    document.uploadedAt,
    document.storagePath,
    document.contentHash,
  );

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

export async function replaceDeadlines(
  matterId: string,
  deadlines: ExtractedDeadline[],
): Promise<MatterDeadline[]> {
  db.prepare("DELETE FROM matter_deadlines WHERE matterId = ?").run(matterId);
  const createdAt = new Date().toISOString();
  const insert = db.prepare(
    "INSERT INTO matter_deadlines (id, matterId, description, dueDate, sourceDocument, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
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
  input: { workedOn: string; description: string; hours: number; rate?: number | null },
): Promise<TimeEntry> {
  const entry: TimeEntry = {
    id: crypto.randomUUID(),
    matterId,
    workedOn: input.workedOn,
    description: input.description,
    hours: input.hours,
    rate: input.rate ?? null,
    invoiceId: null,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO time_entries (id, matterId, workedOn, description, hours, rate, invoiceId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    entry.id,
    entry.matterId,
    entry.workedOn,
    entry.description,
    entry.hours,
    entry.rate,
    entry.invoiceId,
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
  input: { entryIds: string[]; hourlyRate: number; discount: number },
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

  const hours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const subtotal = hours * input.hourlyRate;
  const total = Math.max(0, subtotal - input.discount);
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
  };

  db.prepare(
    `INSERT INTO invoices (id, matterId, invoiceNumber, hourlyRate, hours, subtotal, discount, total, status, paidAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  );

  const markBilled = db.prepare("UPDATE time_entries SET invoiceId = ? WHERE id = ?");
  for (const entryId of input.entryIds) {
    markBilled.run(invoice.id, entryId);
  }

  await recordAuditEvent(
    "invoice_created",
    matterId,
    `Created invoice ${invoice.invoiceNumber} for ${hours.toFixed(1)}h ($${total.toFixed(2)})`,
  );

  return invoice;
}

export async function getInvoice(matterId: string, invoiceId: string): Promise<Invoice | null> {
  const row = db
    .prepare("SELECT * FROM invoices WHERE id = ? AND matterId = ?")
    .get(invoiceId, matterId);
  return row ? toPlain<Invoice>(row) : null;
}

export async function recordInvoiceSent(matterId: string, invoiceNumber: string, to: string): Promise<void> {
  await recordAuditEvent("invoice_sent", matterId, `Emailed invoice ${invoiceNumber} to ${to}`);
}

export async function recordMatterEmailSent(
  matterId: string,
  to: string,
  subject: string,
): Promise<void> {
  await recordAuditEvent("matter_email_sent", matterId, `Emailed ${to}: "${subject}"`);
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

export async function getMatterTextContext(matterId: string): Promise<string> {
  const documents = await listDocuments(matterId);
  const extractable = documents.filter((doc) => isExtractableDocument(doc.fileName));

  const sections = await Promise.all(
    extractable.map(async (doc) => {
      try {
        const text = await extractDocumentText(doc.fileName, doc.storagePath);
        return text ? `--- ${doc.fileName} ---\n${text}` : null;
      } catch {
        return `--- ${doc.fileName} ---\n[Could not extract text from this file]`;
      }
    }),
  );

  const referenceDocs = await listAttachedReferenceDocuments(matterId);
  const referenceSections = await Promise.all(
    referenceDocs
      .filter((doc) => isExtractableDocument(doc.fileName))
      .map(async (doc) => {
        try {
          const text = await extractDocumentText(doc.fileName, doc.storagePath);
          return text ? `--- Reference: ${doc.fileName} ---\n${text}` : null;
        } catch {
          return `--- Reference: ${doc.fileName} ---\n[Could not extract text from this file]`;
        }
      }),
  );

  const notes = await listMatterNotes(matterId);
  const notesSection =
    notes.length > 0
      ? [
          `--- Lawyer's notes ---\n${notes
            .map((n) => `[${n.createdAt.slice(0, 10)}] ${n.content}`)
            .join("\n\n")}`,
        ]
      : [];

  return [
    ...sections.filter((section) => section !== null),
    ...referenceSections.filter((section) => section !== null),
    ...notesSection,
  ].join("\n\n");
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
  const extractable = documents.filter((doc) => isExtractableDocument(doc.fileName));
  const docResults = await Promise.all(
    extractable.map(async (doc) => ({ fileName: doc.fileName, result: await ensureDocumentChunks(doc) })),
  );

  const referenceDocs = await listAttachedReferenceDocuments(matterId);
  const refResults = await Promise.all(
    referenceDocs
      .filter((doc) => isExtractableDocument(doc.fileName))
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

  const notes = await listMatterNotes(matterId);
  const notesSection =
    notes.length > 0
      ? `--- Lawyer's notes ---\n${notes
          .map((n) => `[${n.createdAt.slice(0, 10)}] ${n.content}`)
          .join("\n\n")}`
      : null;

  return [chunkContext, unreadableSection, notesSection].filter(Boolean).join("\n\n");
}
