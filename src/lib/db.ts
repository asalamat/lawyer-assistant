import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Multiple Next.js build/dev worker processes can open this file at once.
// WAL mode allows concurrent readers alongside a writer, and busy_timeout
// makes a connection wait for a lock instead of throwing SQLITE_BUSY.
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");

db.exec(`
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

  CREATE INDEX IF NOT EXISTS idx_documents_matterId ON documents(matterId);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_matterId ON chat_messages(matterId);
  CREATE INDEX IF NOT EXISTS idx_matter_digests_matterId ON matter_digests(matterId);
`);

export default db;

// better-sqlite/node:sqlite rows have a null prototype, which Next.js's RSC
// serialization rejects when passing data from a Server Component to a
// Client Component. Spreading into a plain object literal fixes that.
export function toPlain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}
