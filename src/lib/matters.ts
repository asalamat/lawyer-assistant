import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import { extractDocumentText, isExtractableDocument } from "./textExtraction";
import type { ExtractedDeadline } from "./claude";
import type {
  ChatMessage,
  Document,
  Draft,
  DraftType,
  EvidenceMatrix,
  Matter,
  MatterDeadline,
  MatterDigest,
  MessageFeedback,
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

export async function createMatter(input: {
  title: string;
  clientName: string;
  matterType: string;
}): Promise<Matter> {
  const matter: Matter = {
    id: crypto.randomUUID(),
    title: input.title,
    clientName: input.clientName,
    matterType: input.matterType,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO matters (id, title, clientName, matterType, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    matter.id,
    matter.title,
    matter.clientName,
    matter.matterType,
    matter.status,
    matter.createdAt,
  );
  await recordAuditEvent("matter_created", matter.id, `Created matter "${matter.title}"`);
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
  await writeFile(storagePath, bytes);

  const document: Document = {
    id,
    matterId,
    fileName: file.name,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    storagePath,
  };
  db.prepare(
    "INSERT INTO documents (id, matterId, fileName, sizeBytes, uploadedAt, storagePath) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    document.id,
    document.matterId,
    document.fileName,
    document.sizeBytes,
    document.uploadedAt,
    document.storagePath,
  );
  await recordAuditEvent("document_uploaded", matterId, `Uploaded "${document.fileName}"`);
  return document;
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
  return sections.filter((section) => section !== null).join("\n\n");
}
