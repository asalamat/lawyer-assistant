import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import { extractDocumentText, isExtractableDocument } from "./textExtraction";
import type { ChatMessage, Document, Matter, MatterDigest } from "./types";

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
