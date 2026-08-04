import { cosineSimilarity, embedText, embedTexts } from "./embeddings";
import { chunkExtractedText } from "./chunking";
import db, { toPlain } from "./db";
import { extractDocumentText, isExtractableDocument } from "./textExtraction";
import type { Document, ReferenceDocument } from "./types";

// Generous on purpose: for a small matter with few chunks this returns
// effectively everything (no information lost vs. full-context injection);
// for a large matter it filters down to what's actually relevant to the
// question instead of blowing past the model's context window. Retrieval
// re-ranking / query expansion would improve this further but isn't
// attempted in this pass.
const DEFAULT_TOP_K = 15;

// "unreadable" means extractable in principle but extraction failed or
// produced nothing — the caller uses this to still tell the model the
// document exists, the same way the old full-context builder did with its
// "[Could not extract text from this file]" placeholder, instead of the
// document silently vanishing from context just because it has no chunks.
type ChunkResult = "chunked" | "unreadable" | "skipped";

async function ensureChunksForSource(params: {
  sourceColumn: "documentId" | "referenceDocumentId";
  sourceId: string;
  matterId: string | null;
  fileName: string;
  storagePath: string;
}): Promise<ChunkResult> {
  const { sourceColumn, sourceId, matterId, fileName, storagePath } = params;

  const existing = db
    .prepare(`SELECT COUNT(*) as count FROM document_chunks WHERE ${sourceColumn} = ?`)
    .get(sourceId) as { count: number };
  if (existing.count > 0) return "chunked";
  if (!isExtractableDocument(fileName)) return "skipped";

  let text: string | null;
  try {
    text = await extractDocumentText(fileName, storagePath);
  } catch {
    return "unreadable";
  }
  if (!text) return "unreadable";

  const chunks = chunkExtractedText(text);
  if (chunks.length === 0) return "unreadable";

  const embeddings = await embedTexts(chunks.map((c) => c.text));
  const createdAt = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO document_chunks (id, documentId, referenceDocumentId, matterId, fileName, pageNumber, chunkIndex, text, embedding, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  chunks.forEach((chunk, i) => {
    insert.run(
      crypto.randomUUID(),
      sourceColumn === "documentId" ? sourceId : null,
      sourceColumn === "referenceDocumentId" ? sourceId : null,
      matterId,
      fileName,
      chunk.pageNumber,
      chunk.chunkIndex,
      chunk.text,
      JSON.stringify(embeddings[i]),
      createdAt,
    );
  });
  return "chunked";
}

// Idempotent — skips instantly if this document already has chunks. Safe
// to call on every chat request; the only real work happens once per
// document, the first time it's needed. Returns whether the document ended
// up chunked, so the caller can still mention documents that couldn't be
// read instead of silently dropping them from context.
export async function ensureDocumentChunks(document: Document): Promise<ChunkResult> {
  return ensureChunksForSource({
    sourceColumn: "documentId",
    sourceId: document.id,
    matterId: document.matterId,
    fileName: document.fileName,
    storagePath: document.storagePath,
  });
}

export async function ensureReferenceDocumentChunks(doc: ReferenceDocument): Promise<ChunkResult> {
  return ensureChunksForSource({
    sourceColumn: "referenceDocumentId",
    sourceId: doc.id,
    matterId: null,
    fileName: doc.fileName,
    storagePath: doc.storagePath,
  });
}

export interface RelevantChunk {
  fileName: string;
  pageNumber: number | null;
  text: string;
  score: number;
}

interface ChunkRow {
  fileName: string;
  pageNumber: number | null;
  text: string;
  embedding: string;
}

// Pulls chunks from the matter's own documents plus whichever reference
// library documents are attached to it — the same two-tier
// private/shared model getMatterTextContext already used, just retrieved
// by relevance instead of concatenated in full.
export async function getRelevantChunks(
  matterId: string,
  query: string,
  topK = DEFAULT_TOP_K,
): Promise<RelevantChunk[]> {
  const rows = db
    .prepare(
      `SELECT fileName, pageNumber, text, embedding FROM document_chunks
       WHERE matterId = ?
          OR referenceDocumentId IN (
            SELECT referenceDocumentId FROM matter_reference_documents WHERE matterId = ?
          )`,
    )
    .all(matterId, matterId)
    .map((row) => toPlain<ChunkRow>(row));

  if (rows.length === 0) return [];

  const queryEmbedding = await embedText(query);
  const scored = rows.map((row) => ({
    fileName: row.fileName,
    pageNumber: row.pageNumber,
    text: row.text,
    score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding) as number[]),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export function buildContextFromChunks(chunks: RelevantChunk[]): string {
  return chunks
    .map((c) => `--- ${c.fileName}${c.pageNumber ? `, p. ${c.pageNumber}` : ""} ---\n${c.text}`)
    .join("\n\n");
}
