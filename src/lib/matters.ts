import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { Document, Matter } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

interface Db {
  matters: Matter[];
  documents: Document[];
}

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

async function readDb(): Promise<Db> {
  await ensureDataDir();
  if (!existsSync(DB_PATH)) return { matters: [], documents: [] };
  const raw = await readFile(DB_PATH, "utf-8");
  return JSON.parse(raw) as Db;
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
