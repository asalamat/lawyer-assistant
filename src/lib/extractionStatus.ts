import db from "./db";
import { extractDocumentText, isExtractableDocument } from "./textExtraction";
import type { ExtractionStatus } from "./types";

type ExtractionTable = "documents" | "reference_documents";

function recordExtractionStatus(
  table: ExtractionTable,
  id: string,
  status: ExtractionStatus,
  error: string | null,
): void {
  db.prepare(
    `UPDATE ${table} SET extractionStatus = ?, extractionError = ?, extractionCheckedAt = ? WHERE id = ?`,
  ).run(status, error, new Date().toISOString(), id);
}

// Single place extraction is attempted from (getMatterTextContext and
// ensureChunksForSource both called extractDocumentText directly and
// swallowed failures into a placeholder string with no persisted record —
// this keeps the same "never fail the caller" contract but now leaves a
// trail a lawyer can actually see and retry, instead of a silent skip that
// only shows up as "the AI didn't mention this document."
export async function extractTextTracked(
  table: ExtractionTable,
  id: string,
  fileName: string,
  storagePath: string,
): Promise<string | null> {
  if (!isExtractableDocument(fileName)) {
    recordExtractionStatus(table, id, "unsupported", null);
    return null;
  }

  try {
    const text = await extractDocumentText(fileName, storagePath);
    if (!text || !text.trim()) {
      recordExtractionStatus(table, id, "failed", "Extraction produced no text");
      return null;
    }
    recordExtractionStatus(table, id, "ok", null);
    return text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordExtractionStatus(table, id, "failed", message);
    return null;
  }
}
