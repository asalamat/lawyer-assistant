import { cosineSimilarity, embedText, embedTexts } from "./embeddings";
import { CHUNK_OVERLAP, chunkExtractedText } from "./chunking";
import db, { toPlain } from "./db";
import { extractTextTracked } from "./extractionStatus";
import { isExtractableDocument } from "./textExtraction";
import type { Document, ReferenceDocument } from "./types";

// Generous on purpose: for a small matter with few chunks this returns
// effectively everything (no information lost vs. full-context injection);
// for a large matter it filters down to what's actually relevant to the
// question instead of blowing past the model's context window.
const DEFAULT_TOP_K = 15;

// Vector search alone under-ranks passages whose relevance is a specific
// name, case number, or statute section rather than paraphrased meaning —
// exactly the kind of exact-match legal text embeddings are weakest on. So
// retrieval over-fetches by vector similarity, then re-ranks that wider
// candidate pool with a cheap lexical-overlap signal before taking the
// final top K. No extra AI call — both signals are computed locally.
const CANDIDATE_POOL_MULTIPLIER = 4;
const VECTOR_WEIGHT = 0.75;
const LEXICAL_WEIGHT = 0.25;

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

  const table = sourceColumn === "documentId" ? "documents" : "reference_documents";
  const text = await extractTextTracked(table, sourceId, fileName, storagePath);
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
  documentId: string | null;
  referenceDocumentId: string | null;
  fileName: string;
  pageNumber: number | null;
  chunkIndex: number;
  text: string;
  embedding: string;
}

interface NeighborRow {
  pageNumber: number | null;
  text: string;
}

// Splits the query into lowercase word tokens for lexical overlap scoring —
// no stemming/stopword removal, just enough to catch exact-term matches
// (names, case numbers, statute sections) vector similarity can miss.
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

// Fraction of distinct query terms that appear in the chunk text — cheap,
// deterministic, no AI call. Combined with vector similarity as a
// re-ranking signal (see CANDIDATE_POOL_MULTIPLIER above).
function lexicalOverlapScore(queryTerms: Set<string>, text: string): number {
  if (queryTerms.size === 0) return 0;
  const chunkTerms = new Set(tokenize(text));
  let hits = 0;
  for (const term of queryTerms) {
    if (chunkTerms.has(term)) hits++;
  }
  return hits / queryTerms.size;
}

// Fetches the chunk immediately before/after this one from the same
// source document, so a matched passage can be stitched together with its
// surrounding context ("parent-child" retrieval) instead of being handed
// to the model as an isolated ~1500-char fragment.
function fetchNeighborChunk(
  documentId: string | null,
  referenceDocumentId: string | null,
  chunkIndex: number,
): NeighborRow | null {
  const column = documentId ? "documentId" : "referenceDocumentId";
  const sourceId = documentId ?? referenceDocumentId;
  const row = db
    .prepare(`SELECT pageNumber, text FROM document_chunks WHERE ${column} = ? AND chunkIndex = ?`)
    .get(sourceId, chunkIndex);
  return row ? toPlain<NeighborRow>(row) : null;
}

// Same-page neighbors were produced by a sliding window with a known
// overlap (see chunking.ts) — trim that exact overlap back out rather than
// duplicating text in the model's context. Neighbors from a different page
// (or none) are simply concatenated.
function stitchWithNeighbors(
  documentId: string | null,
  referenceDocumentId: string | null,
  pageNumber: number | null,
  chunkIndex: number,
  text: string,
): string {
  const prev = chunkIndex > 0 ? fetchNeighborChunk(documentId, referenceDocumentId, chunkIndex - 1) : null;
  const next = fetchNeighborChunk(documentId, referenceDocumentId, chunkIndex + 1);

  const beforePart = prev
    ? prev.pageNumber === pageNumber && prev.text.length > CHUNK_OVERLAP
      ? prev.text.slice(0, -CHUNK_OVERLAP)
      : prev.text
    : "";

  const afterPart = next
    ? next.pageNumber === pageNumber && next.text.length > CHUNK_OVERLAP
      ? next.text.slice(CHUNK_OVERLAP)
      : next.text
    : "";

  return [beforePart, text, afterPart].filter(Boolean).join(" … ");
}

// Pulls chunks from the matter's own documents plus whichever reference
// library documents are attached to it — the same two-tier
// private/shared model getMatterTextContext already used, just retrieved
// by relevance instead of concatenated in full. Retrieval is two stages:
// a wide vector-similarity pass to build a candidate pool, then a hybrid
// vector+lexical re-rank of that pool to pick the final top K, each
// expanded with its neighboring chunks (parent-child retrieval).
export async function getRelevantChunks(
  matterId: string,
  query: string,
  topK = DEFAULT_TOP_K,
): Promise<RelevantChunk[]> {
  const rows = db
    .prepare(
      `SELECT documentId, referenceDocumentId, fileName, pageNumber, chunkIndex, text, embedding FROM document_chunks
       WHERE matterId = ?
          OR referenceDocumentId IN (
            SELECT referenceDocumentId FROM matter_reference_documents WHERE matterId = ?
          )`,
    )
    .all(matterId, matterId)
    .map((row) => toPlain<ChunkRow>(row));

  if (rows.length === 0) return [];

  const queryEmbedding = await embedText(query);
  const byVectorScore = rows
    .map((row) => ({ row, vectorScore: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding) as number[]) }))
    .sort((a, b) => b.vectorScore - a.vectorScore);

  const candidatePoolSize = Math.min(byVectorScore.length, topK * CANDIDATE_POOL_MULTIPLIER);
  const candidates = byVectorScore.slice(0, candidatePoolSize);

  const queryTerms = new Set(tokenize(query));
  const reranked = candidates
    .map(({ row, vectorScore }) => ({
      row,
      vectorScore,
      hybridScore: VECTOR_WEIGHT * vectorScore + LEXICAL_WEIGHT * lexicalOverlapScore(queryTerms, row.text),
    }))
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, topK);

  // `score` stays a plain vector cosine similarity (what
  // LOW_CONFIDENCE_THRESHOLD below is calibrated against) — the hybrid
  // score only decides which chunks made the cut and in what order.
  return reranked.map(({ row, vectorScore }) => ({
    fileName: row.fileName,
    pageNumber: row.pageNumber,
    text: stitchWithNeighbors(row.documentId, row.referenceDocumentId, row.pageNumber, row.chunkIndex, row.text),
    score: vectorScore,
  }));
}

export function buildContextFromChunks(chunks: RelevantChunk[]): string {
  return chunks
    .map((c) => `--- ${c.fileName}${c.pageNumber ? `, p. ${c.pageNumber}` : ""} ---\n${c.text}`)
    .join("\n\n");
}

// Empirically, on text-embedding-3-small, a passage that genuinely answers
// a legal question scores meaningfully above this against it — a top score
// below it means retrieval didn't find anything strongly on-point, and the
// model should be told that explicitly rather than left to infer it from
// the passages' content alone (which risks stretching a tangential match
// into an answer it can't really support).
const LOW_CONFIDENCE_THRESHOLD = 0.35;

// Surfaces retrieval confidence as an explicit signal in the prompt itself
// — "insufficient evidence" gating per the architecture doc's retrieval
// quality controls — rather than relying only on a general "don't guess"
// instruction with no concrete signal of whether THIS retrieval actually
// found anything relevant.
export function buildRetrievalConfidenceNote(chunks: RelevantChunk[]): string | null {
  if (chunks.length === 0) {
    return "--- Retrieval note: no indexed passages exist for this matter yet (no readable documents, or none chunked). Say so rather than answering from general knowledge. ---";
  }
  const topScore = chunks[0].score;
  if (topScore < LOW_CONFIDENCE_THRESHOLD) {
    return `--- Retrieval confidence note: none of the retrieved passages scored strongly relevant to this specific question (top match score ${topScore.toFixed(2)}, low). If they don't actually answer what was asked, say the documents don't contain enough information rather than stretching a weak match into an answer. ---`;
  }
  return null;
}
