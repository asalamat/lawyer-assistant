import db from "./db";
import { detectLanguage } from "./languageDetection";
import { extractDocumentText, isExtractableDocument } from "./textExtraction";
import type { ExtractionStatus } from "./types";

type ExtractionTable = "documents" | "reference_documents";

// Tesseract's own confidence directly reflects how reliable OCR'd text is —
// used as-is, capped below 100 since OCR is inherently less certain than
// text extracted directly from a native PDF/Word encoding even at high
// confidence. Non-OCR extraction has no equivalent per-character confidence
// signal, so it only gets penalized for the pathological case of
// technically-non-empty but too-short-to-be-useful output.
function computeQualityScore(text: string, ocrConfidence: number | undefined): number {
  if (ocrConfidence !== undefined) return Math.min(95, Math.round(ocrConfidence));
  return text.trim().length < 50 ? 50 : 100;
}

function recordExtractionStatus(
  table: ExtractionTable,
  id: string,
  status: ExtractionStatus,
  error: string | null,
  extra?: { detectedLanguage: string; ocrConfidence: number | null; qualityScore: number },
): void {
  if (extra) {
    db.prepare(
      `UPDATE ${table} SET extractionStatus = ?, extractionError = ?, extractionCheckedAt = ?,
         detectedLanguage = ?, ocrConfidence = ?, qualityScore = ? WHERE id = ?`,
    ).run(
      status,
      error,
      new Date().toISOString(),
      extra.detectedLanguage,
      extra.ocrConfidence,
      extra.qualityScore,
      id,
    );
    return;
  }
  db.prepare(
    `UPDATE ${table} SET extractionStatus = ?, extractionError = ?, extractionCheckedAt = ? WHERE id = ?`,
  ).run(status, error, new Date().toISOString(), id);
}

// Single place extraction is attempted from (getMatterTextContext and
// ensureChunksForSource both called extractDocumentText directly and
// swallowed failures into a placeholder string with no persisted record —
// this keeps the same "never fail the caller" contract but now leaves a
// trail a lawyer can actually see and retry, instead of a silent skip that
// only shows up as "the AI didn't mention this document." Also records
// detected language, OCR confidence (images only), and a quality score.
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
    const result = await extractDocumentText(fileName, storagePath);
    // A photo often has no legible text at all — its AI-generated visual
    // description (see analyzeDocumentPhoto in matters.ts) is merged in
    // here, the one place every caller (full-context generators via
    // getMatterDocumentSections, and chat retrieval via
    // ensureChunksForSource) gets a document's text from. Without this, a
    // photo with a real description but no OCR text would still count as
    // "failed to extract" below.
    const photoAnalysis =
      table === "documents"
        ? (db.prepare("SELECT photoAnalysisResult FROM documents WHERE id = ?").get(id) as
            | { photoAnalysisResult: string | null }
            | undefined)
        : undefined;
    const combinedText = [
      result?.text?.trim(),
      photoAnalysis?.photoAnalysisResult ? `[AI visual description]\n${photoAnalysis.photoAnalysisResult}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!combinedText) {
      recordExtractionStatus(table, id, "failed", "Extraction produced no text");
      return null;
    }
    recordExtractionStatus(table, id, "ok", null, {
      detectedLanguage: detectLanguage(combinedText),
      ocrConfidence: result?.ocrConfidence ?? null,
      qualityScore: computeQualityScore(combinedText, result?.ocrConfidence),
    });
    return combinedText;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordExtractionStatus(table, id, "failed", message);
    return null;
  }
}
