import db, { toPlain } from "./db";
import type { ChatMessage, Document, Matter } from "./types";

const SNIPPET_RADIUS = 80;

function snippet(text: string, term: string): string {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + term.length + SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

// Boolean search syntax: space-separated terms are required (AND), a
// leading "-" excludes a term, and "word1 word2" in quotes matches that
// exact phrase. No explicit OR — every other search feature in this app
// (chat retrieval, citation checking) is also AND-only substring matching,
// and OR would need real full-text search (FTS5) to do well; not worth the
// added complexity for a LIKE-based search over a handful of tables.
export interface ParsedQuery {
  include: string[];
  exclude: string[];
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const tokens = raw.match(/-?"[^"]+"|-?\S+/g) ?? [];
  const include: string[] = [];
  const exclude: string[] = [];
  for (const token of tokens) {
    const isExclude = token.startsWith("-");
    const unwrapped = isExclude ? token.slice(1) : token;
    const term = unwrapped.startsWith('"') && unwrapped.endsWith('"') && unwrapped.length > 1
      ? unwrapped.slice(1, -1)
      : unwrapped;
    if (!term) continue;
    (isExclude ? exclude : include).push(term);
  }
  return { include, exclude };
}

// Escapes SQLite LIKE wildcards so a literal "%" or "_" in a search term is
// matched literally instead of acting as a wildcard.
function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

// Builds a `(col1 LIKE ? OR col2 LIKE ?) AND (...) AND NOT (...)` clause
// requiring every include term (and none of the exclude terms) to appear
// in at least one of the given columns.
function buildBooleanWhere(
  columns: string[],
  parsed: ParsedQuery,
): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  const likeColumns = columns.map((c) => `${c} LIKE ? ESCAPE '\\'`);
  for (const term of parsed.include) {
    clauses.push(`(${likeColumns.join(" OR ")})`);
    params.push(...columns.map(() => `%${escapeLike(term)}%`));
  }
  for (const term of parsed.exclude) {
    clauses.push(`NOT (${likeColumns.join(" OR ")})`);
    params.push(...columns.map(() => `%${escapeLike(term)}%`));
  }
  return { sql: clauses.length > 0 ? clauses.join(" AND ") : "1=1", params };
}

function firstMatchingTerm(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  return terms.find((term) => lower.includes(term.toLowerCase())) ?? terms[0] ?? "";
}

export interface SearchResults {
  terms: string[];
  matters: Matter[];
  documents: (Document & { matterTitle: string })[];
  documentContent: {
    id: string;
    documentId: string;
    matterId: string;
    matterTitle: string;
    fileName: string;
    pageNumber: number | null;
    snippet: string;
  }[];
  chatMessages: (ChatMessage & { matterTitle: string; snippet: string })[];
  digests: { id: string; matterId: string; matterTitle: string; snippet: string }[];
  drafts: { id: string; matterId: string; matterTitle: string; draftType: string; snippet: string }[];
  evidenceMatrices: { id: string; matterId: string; matterTitle: string; snippet: string }[];
}

export interface SearchFilters {
  partyName?: string;
  matterType?: string;
  status?: Matter["status"];
  // Inclusive, compared against matters.createdAt (ISO strings sort
  // correctly as plain text, no date parsing needed).
  dateFrom?: string;
  dateTo?: string;
}

// Computes which matters satisfy the given filters, or null if none are
// set (meaning "don't restrict by filters at all" — distinct from an empty
// Set, which would mean "no matter matches"). Every other result category
// already carries a matterId, so this one allowlist cascades to all of
// them without needing a per-table filter query.
function computeMatterIdFilter(filters: SearchFilters): Set<string> | null {
  const clauses: string[] = [];
  const params: string[] = [];
  let joinParties = false;

  if (filters.partyName?.trim()) {
    joinParties = true;
    clauses.push("p.name LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(filters.partyName.trim())}%`);
  }
  if (filters.matterType?.trim()) {
    clauses.push("m.matterType = ?");
    params.push(filters.matterType.trim());
  }
  if (filters.status) {
    clauses.push("m.status = ?");
    params.push(filters.status);
  }
  if (filters.dateFrom) {
    clauses.push("m.createdAt >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    // createdAt is a full timestamp; a bare date like "2026-08-01" as the
    // upper bound would exclude that whole day — push to end-of-day.
    clauses.push("m.createdAt <= ?");
    params.push(`${filters.dateTo}T23:59:59.999Z`);
  }

  if (clauses.length === 0) return null;

  const sql = `SELECT DISTINCT m.id as id FROM matters m ${
    joinParties ? "JOIN parties p ON p.matterId = m.id" : ""
  } WHERE ${clauses.join(" AND ")}`;
  const rows = db.prepare(sql).all(...params) as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

export async function searchAll(query: string, filters: SearchFilters = {}): Promise<SearchResults> {
  const parsed = parseSearchQuery(query);
  if (parsed.include.length === 0) {
    return {
      terms: [],
      matters: [],
      documents: [],
      documentContent: [],
      chatMessages: [],
      digests: [],
      drafts: [],
      evidenceMatrices: [],
    };
  }
  const terms = parsed.include;
  const matterIdFilter = computeMatterIdFilter(filters);
  const passesFilter = (matterId: string) => matterIdFilter === null || matterIdFilter.has(matterId);

  const mattersWhere = buildBooleanWhere(["title", "clientName", "matterType"], parsed);
  const matters = db
    .prepare(`SELECT * FROM matters WHERE ${mattersWhere.sql} ORDER BY createdAt DESC`)
    .all(...mattersWhere.params)
    .map((row) => toPlain<Matter>(row));

  const documentsWhere = buildBooleanWhere(["d.fileName"], parsed);
  const documents = db
    .prepare(
      `SELECT d.*, m.title as matterTitle FROM documents d
       JOIN matters m ON m.id = d.matterId
       WHERE ${documentsWhere.sql} ORDER BY d.uploadedAt DESC`,
    )
    .all(...documentsWhere.params)
    .map((row) => toPlain<Document & { matterTitle: string }>(row));

  // Document *content* matches — searches the same chunk text used for chat
  // retrieval, so a term found deep inside a large PDF surfaces here even
  // when it's nowhere in the filename. One row per document (first
  // matching chunk), not one row per chunk, to avoid a single large
  // document flooding the results list.
  const chunksWhere = buildBooleanWhere(["c.text"], parsed);
  const documentContent = db
    .prepare(
      `SELECT c.id, c.documentId, c.matterId, c.fileName, c.pageNumber, c.text,
              m.title as matterTitle, MIN(c.chunkIndex) as firstChunk
       FROM document_chunks c
       JOIN matters m ON m.id = c.matterId
       WHERE c.documentId IS NOT NULL AND ${chunksWhere.sql}
       GROUP BY c.documentId
       ORDER BY m.title
       LIMIT 50`,
    )
    .all(...chunksWhere.params)
    .map((row) =>
      toPlain<{
        id: string;
        documentId: string;
        matterId: string;
        fileName: string;
        pageNumber: number | null;
        text: string;
        matterTitle: string;
      }>(row),
    )
    .map((row) => ({
      id: row.id,
      documentId: row.documentId,
      matterId: row.matterId,
      matterTitle: row.matterTitle,
      fileName: row.fileName,
      pageNumber: row.pageNumber,
      snippet: snippet(row.text, firstMatchingTerm(row.text, terms)),
    }));

  const chatWhere = buildBooleanWhere(["c.content"], parsed);
  const chatMessages = db
    .prepare(
      `SELECT c.*, m.title as matterTitle FROM chat_messages c
       JOIN matters m ON m.id = c.matterId
       WHERE ${chatWhere.sql} ORDER BY c.createdAt DESC LIMIT 50`,
    )
    .all(...chatWhere.params)
    .map((row) => toPlain<ChatMessage & { matterTitle: string }>(row))
    .map((row) => ({ ...row, snippet: snippet(row.content, firstMatchingTerm(row.content, terms)) }));

  const digestsWhere = buildBooleanWhere(["g.content"], parsed);
  const digests = db
    .prepare(
      `SELECT g.id, g.matterId, m.title as matterTitle, g.content FROM matter_digests g
       JOIN matters m ON m.id = g.matterId
       WHERE ${digestsWhere.sql} ORDER BY g.createdAt DESC LIMIT 50`,
    )
    .all(...digestsWhere.params)
    .map((row) => toPlain<{ id: string; matterId: string; matterTitle: string; content: string }>(row))
    .map((row) => ({
      id: row.id,
      matterId: row.matterId,
      matterTitle: row.matterTitle,
      snippet: snippet(row.content, firstMatchingTerm(row.content, terms)),
    }));

  const draftsWhere = buildBooleanWhere(["dr.content", "dr.draftType"], parsed);
  const drafts = db
    .prepare(
      `SELECT dr.id, dr.matterId, m.title as matterTitle, dr.draftType, dr.content FROM drafts dr
       JOIN matters m ON m.id = dr.matterId
       WHERE ${draftsWhere.sql} ORDER BY dr.createdAt DESC LIMIT 50`,
    )
    .all(...draftsWhere.params)
    .map((row) =>
      toPlain<{ id: string; matterId: string; matterTitle: string; draftType: string; content: string }>(row),
    )
    .map((row) => ({
      id: row.id,
      matterId: row.matterId,
      matterTitle: row.matterTitle,
      draftType: row.draftType,
      snippet: snippet(row.content, firstMatchingTerm(row.content, terms)),
    }));

  const evidenceWhere = buildBooleanWhere(["e.content"], parsed);
  const evidenceMatrices = db
    .prepare(
      `SELECT e.id, e.matterId, m.title as matterTitle, e.content FROM evidence_matrices e
       JOIN matters m ON m.id = e.matterId
       WHERE ${evidenceWhere.sql} ORDER BY e.createdAt DESC LIMIT 50`,
    )
    .all(...evidenceWhere.params)
    .map((row) => toPlain<{ id: string; matterId: string; matterTitle: string; content: string }>(row))
    .map((row) => ({
      id: row.id,
      matterId: row.matterId,
      matterTitle: row.matterTitle,
      snippet: snippet(row.content, firstMatchingTerm(row.content, terms)),
    }));

  return {
    terms,
    matters: matters.filter((m) => passesFilter(m.id)),
    documents: documents.filter((d) => passesFilter(d.matterId)),
    documentContent: documentContent.filter((d) => passesFilter(d.matterId)),
    chatMessages: chatMessages.filter((c) => passesFilter(c.matterId)),
    digests: digests.filter((d) => passesFilter(d.matterId)),
    drafts: drafts.filter((d) => passesFilter(d.matterId)),
    evidenceMatrices: evidenceMatrices.filter((e) => passesFilter(e.matterId)),
  };
}
