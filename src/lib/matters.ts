import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { extractDocumentText, isExtractableDocument } from "./textExtraction";
import type { ChatMessage, Document, Matter } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

interface Db {
  matters: Matter[];
  documents: Document[];
  chatMessages: ChatMessage[];
}

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

async function readDb(): Promise<Db> {
  await ensureDataDir();
  if (!existsSync(DB_PATH)) return { matters: [], documents: [], chatMessages: [] };
  const raw = await readFile(DB_PATH, "utf-8");
  const db = JSON.parse(raw) as Partial<Db>;
  return {
    matters: db.matters ?? [],
    documents: db.documents ?? [],
    chatMessages: db.chatMessages ?? [],
  };
}

async function writeDb(db: Db): Promise<void> {
  await ensureDataDir();
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export async function listMatters(): Promise<Matter[]> {
  const db = await readDb();
  return db.matters.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMatter(id: string): Promise<Matter | null> {
  const db = await readDb();
  return db.matters.find((m) => m.id === id) ?? null;
}

export async function createMatter(input: {
  title: string;
  clientName: string;
  matterType: string;
}): Promise<Matter> {
  const db = await readDb();
  const matter: Matter = {
    id: crypto.randomUUID(),
    title: input.title,
    clientName: input.clientName,
    matterType: input.matterType,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  db.matters.push(matter);
  await writeDb(db);
  return matter;
}

export async function listDocuments(matterId: string): Promise<Document[]> {
  const db = await readDb();
  return db.documents
    .filter((d) => d.matterId === matterId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function addDocument(
  matterId: string,
  file: File,
): Promise<Document> {
  const db = await readDb();
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
  db.documents.push(document);
  await writeDb(db);
  return document;
}

export async function listChatMessages(matterId: string): Promise<ChatMessage[]> {
  const db = await readDb();
  return db.chatMessages
    .filter((m) => m.matterId === matterId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addChatMessage(
  matterId: string,
  role: ChatMessage["role"],
  content: string,
): Promise<ChatMessage> {
  const db = await readDb();
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    matterId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  db.chatMessages.push(message);
  await writeDb(db);
  return message;
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
