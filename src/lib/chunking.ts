export interface TextChunk {
  pageNumber: number | null;
  chunkIndex: number;
  text: string;
}

// Sized in characters, not tokens, to avoid a tokenizer dependency —
// ~1500 chars is roughly 350-400 tokens for typical English legal text,
// small enough to keep retrieved context focused, large enough to keep a
// paragraph or two of surrounding context together.
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

function splitIntoWindows(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= CHUNK_SIZE) return [trimmed];

  const windows: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + CHUNK_SIZE, trimmed.length);
    windows.push(trimmed.slice(start, end));
    if (end === trimmed.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return windows;
}

const PAGE_MARKER = /^\[Page (\d+)\]\n/;

// Splits extracted document text into overlapping chunks for embedding.
// Text from PDFs carries "[Page N]" markers (see textExtraction.ts) — each
// page is chunked separately so every chunk keeps a single, accurate page
// number. Text without markers (DOCX, OCR, transcripts, spreadsheets) is
// chunked as one unpaginated section.
export function chunkExtractedText(text: string): TextChunk[] {
  if (!text || !text.trim()) return [];

  const sections = text.split(/\n\n(?=\[Page \d+\])/);
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  for (const section of sections) {
    const match = section.match(PAGE_MARKER);
    const pageNumber = match ? Number(match[1]) : null;
    const body = match ? section.slice(match[0].length) : section;
    for (const window of splitIntoWindows(body)) {
      chunks.push({ pageNumber, chunkIndex: chunkIndex++, text: window });
    }
  }
  return chunks;
}
