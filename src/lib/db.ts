import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Multiple Next.js build/dev worker processes can open this file at once.
// busy_timeout alone doesn't cover every race on a brand-new file — the
// WAL-mode switch itself and the initial schema creation can both throw
// SQLITE_BUSY immediately if another process is mid-initializing the same
// file. Retry each of those with a short synchronous backoff.
function isBusyError(err: unknown): boolean {
  const text = String(err) + String((err as { cause?: unknown })?.cause ?? "");
  return text.includes("database is locked") || text.includes("SQLITE_BUSY");
}

function execWithRetry(sql: string, attempts = 10): void {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      db.exec(sql);
      return;
    } catch (err) {
      if (!isBusyError(err) || attempt === attempts - 1) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (attempt + 1));
    }
  }
}

execWithRetry("PRAGMA journal_mode = WAL;");
execWithRetry("PRAGMA busy_timeout = 5000;");

execWithRetry(`
  CREATE TABLE IF NOT EXISTS matters (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    clientName TEXT NOT NULL,
    matterType TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    fileName TEXT NOT NULL,
    sizeBytes INTEGER NOT NULL,
    uploadedAt TEXT NOT NULL,
    storagePath TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    matterId TEXT,
    detail TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS matter_digests (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS message_feedback (
    id TEXT PRIMARY KEY,
    chatMessageId TEXT NOT NULL UNIQUE,
    rating TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (chatMessageId) REFERENCES chat_messages(id)
  );

  CREATE TABLE IF NOT EXISTS matter_deadlines (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    description TEXT NOT NULL,
    dueDate TEXT,
    sourceDocument TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    draftType TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE TABLE IF NOT EXISTS evidence_matrices (
    id TEXT PRIMARY KEY,
    matterId TEXT NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (matterId) REFERENCES matters(id)
  );

  CREATE INDEX IF NOT EXISTS idx_documents_matterId ON documents(matterId);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_matterId ON chat_messages(matterId);
  CREATE INDEX IF NOT EXISTS idx_matter_digests_matterId ON matter_digests(matterId);
  CREATE INDEX IF NOT EXISTS idx_matter_deadlines_matterId ON matter_deadlines(matterId);
  CREATE INDEX IF NOT EXISTS idx_drafts_matterId ON drafts(matterId);
  CREATE INDEX IF NOT EXISTS idx_evidence_matrices_matterId ON evidence_matrices(matterId);
`);

export default db;

// better-sqlite/node:sqlite rows have a null prototype, which Next.js's RSC
// serialization rejects when passing data from a Server Component to a
// Client Component. Spreading into a plain object literal fixes that.
export function toPlain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}
