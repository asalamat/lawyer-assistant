import db, { toPlain } from "./db";
import type { ChatMessage, Document, Matter } from "./types";

const SNIPPET_RADIUS = 80;

function snippet(text: string, query: string): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + query.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export interface SearchResults {
  matters: Matter[];
  documents: (Document & { matterTitle: string })[];
  chatMessages: (ChatMessage & { matterTitle: string; snippet: string })[];
  digests: { id: string; matterId: string; matterTitle: string; snippet: string }[];
  drafts: { id: string; matterId: string; matterTitle: string; draftType: string; snippet: string }[];
  evidenceMatrices: { id: string; matterId: string; matterTitle: string; snippet: string }[];
}

export async function searchAll(query: string): Promise<SearchResults> {
  const like = `%${query}%`;

  const matters = db
    .prepare(
      "SELECT * FROM matters WHERE title LIKE ? OR clientName LIKE ? OR matterType LIKE ? ORDER BY createdAt DESC",
    )
    .all(like, like, like)
    .map((row) => toPlain<Matter>(row));

  const documents = db
    .prepare(
      `SELECT d.*, m.title as matterTitle FROM documents d
       JOIN matters m ON m.id = d.matterId
       WHERE d.fileName LIKE ? ORDER BY d.uploadedAt DESC`,
    )
    .all(like)
    .map((row) => toPlain<Document & { matterTitle: string }>(row));

  const chatMessages = db
    .prepare(
      `SELECT c.*, m.title as matterTitle FROM chat_messages c
       JOIN matters m ON m.id = c.matterId
       WHERE c.content LIKE ? ORDER BY c.createdAt DESC LIMIT 50`,
    )
    .all(like)
    .map((row) => toPlain<ChatMessage & { matterTitle: string }>(row))
    .map((row) => ({ ...row, snippet: snippet(row.content, query) }));

  const digests = db
    .prepare(
      `SELECT g.id, g.matterId, m.title as matterTitle, g.content FROM matter_digests g
       JOIN matters m ON m.id = g.matterId
       WHERE g.content LIKE ? ORDER BY g.createdAt DESC LIMIT 50`,
    )
    .all(like)
    .map((row) => toPlain<{ id: string; matterId: string; matterTitle: string; content: string }>(row))
    .map((row) => ({ id: row.id, matterId: row.matterId, matterTitle: row.matterTitle, snippet: snippet(row.content, query) }));

  const drafts = db
    .prepare(
      `SELECT dr.id, dr.matterId, m.title as matterTitle, dr.draftType, dr.content FROM drafts dr
       JOIN matters m ON m.id = dr.matterId
       WHERE dr.content LIKE ? OR dr.draftType LIKE ? ORDER BY dr.createdAt DESC LIMIT 50`,
    )
    .all(like, like)
    .map((row) =>
      toPlain<{ id: string; matterId: string; matterTitle: string; draftType: string; content: string }>(row),
    )
    .map((row) => ({
      id: row.id,
      matterId: row.matterId,
      matterTitle: row.matterTitle,
      draftType: row.draftType,
      snippet: snippet(row.content, query),
    }));

  const evidenceMatrices = db
    .prepare(
      `SELECT e.id, e.matterId, m.title as matterTitle, e.content FROM evidence_matrices e
       JOIN matters m ON m.id = e.matterId
       WHERE e.content LIKE ? ORDER BY e.createdAt DESC LIMIT 50`,
    )
    .all(like)
    .map((row) => toPlain<{ id: string; matterId: string; matterTitle: string; content: string }>(row))
    .map((row) => ({ id: row.id, matterId: row.matterId, matterTitle: row.matterTitle, snippet: snippet(row.content, query) }));

  return { matters, documents, chatMessages, digests, drafts, evidenceMatrices };
}
