import { readFile, rename, writeFile } from "fs/promises";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { recognize } from "tesseract.js";
import { read, utils } from "xlsx";
import { decryptFile, encryptFile, isEncryptedFile } from "./crypto";
import { transcribeAudio } from "./transcription";

// Renders a detected table (PDF vector-grid detection or a DOCX table
// element — both reduce to a plain string grid) as a markdown table, the
// format an LLM is best trained on for tabular reasoning. Appended
// alongside the page/paragraph's own flattened text rather than replacing
// it — table detection is heuristic, so the model keeps the raw fallback
// too instead of trusting a possibly-misdetected structure blindly.
function renderMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const escapeCell = (cell: string) => (cell ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
  const [header, ...body] = rows.map((row) => row.map(escapeCell));
  const lines = [header, header.map(() => "---"), ...body].map((row) => `| ${row.join(" | ")} |`);
  return lines.join("\n");
}

const PLAIN_TEXT_EXTENSIONS = [".txt", ".md"];
const PDF_EXTENSIONS = [".pdf"];
const DOCX_EXTENSIONS = [".docx"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const SPREADSHEET_EXTENSIONS = [".csv", ".xlsx", ".xls"];
// OpenAI's documented transcription input formats (whisper-1, 25MB limit).
const AUDIO_VIDEO_EXTENSIONS = [
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".m4a",
  ".wav",
  ".webm",
];

interface MammothElement {
  type: string;
  value?: string;
  children?: MammothElement[];
}

function elementToText(element: MammothElement): string {
  if (element.type === "text") return element.value ?? "";
  if (element.type === "tab") return "\t";
  return (element.children ?? []).map(elementToText).join("");
}

function getDescendantsOfType(element: MammothElement, type: string): MammothElement[] {
  const found: MammothElement[] = [];
  for (const child of element.children ?? []) {
    if (child.type === type) found.push(child);
    found.push(...getDescendantsOfType(child, type));
  }
  return found;
}

// mammoth's public API has no "give me the tables" call — extractRawText
// flattens every cell into the surrounding text with no row/column
// markers at all, and convertToMarkdown doesn't handle <table> either (it
// has no markdown-writer entry for table/tr/td, so cells run together with
// no separators). The transformDocument hook is the only supported way to
// reach the parsed document tree, so this walks it to pull out each
// table's cells as a plain string grid — merged cells (colspan/rowspan)
// aren't unmerged, just read as-is.
async function extractDocxTables(buffer: Buffer): Promise<string[][][]> {
  const tables: string[][][] = [];
  await mammoth.convertToHtml(
    { buffer },
    {
      transformDocument: (document: MammothElement) => {
        for (const table of getDescendantsOfType(document, "table")) {
          const rows = (table.children ?? [])
            .filter((child) => child.type === "tableRow")
            .map((row) =>
              (row.children ?? [])
                .filter((cell) => cell.type === "tableCell")
                .map((cell) => elementToText(cell).replace(/\s+/g, " ").trim()),
            )
            .filter((row) => row.length > 0);
          if (rows.length > 0) tables.push(rows);
        }
        return document;
      },
    },
  );
  return tables;
}

function hasExtension(fileName: string, extensions: string[]): boolean {
  const lower = fileName.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

export function isExtractableDocument(fileName: string): boolean {
  return [
    ...PLAIN_TEXT_EXTENSIONS,
    ...PDF_EXTENSIONS,
    ...DOCX_EXTENSIONS,
    ...IMAGE_EXTENSIONS,
    ...SPREADSHEET_EXTENSIONS,
    ...AUDIO_VIDEO_EXTENSIONS,
  ].some((ext) => fileName.toLowerCase().endsWith(ext));
}

// A file ClamAV flagged as infected is never read as AI context, chunked,
// or shown as "chat-readable" — quarantine means isolated, not just
// labeled. Every extractable-document filter in this app should use this
// instead of isExtractableDocument alone once malware scanning is in play.
export function isSafeToExtract(doc: { fileName: string; malwareScanStatus?: string | null }): boolean {
  return isExtractableDocument(doc.fileName) && doc.malwareScanStatus !== "infected";
}

export function isImageFile(fileName: string): boolean {
  return hasExtension(fileName, IMAGE_EXTENSIONS);
}

const IMAGE_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function getImageMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  const ext = Object.keys(IMAGE_MIME_TYPES).find((e) => lower.endsWith(e));
  return ext ? IMAGE_MIME_TYPES[ext] : "application/octet-stream";
}

// Documents on disk are encrypted at rest. Files uploaded before that
// shipped are still plaintext there — detect and migrate those in place the
// first time they're read, rather than requiring a separate migration step.
// Exported for reuse anywhere else that needs a document's raw bytes (e.g.
// attaching an uploaded document to an outgoing email).
export async function readPlaintextFile(storagePath: string): Promise<Buffer> {
  const raw = await readFile(storagePath);
  if (isEncryptedFile(raw)) return decryptFile(raw);

  const tmpPath = `${storagePath}.tmp`;
  await writeFile(tmpPath, await encryptFile(raw));
  await rename(tmpPath, storagePath);
  return raw;
}

export interface ExtractionResult {
  text: string;
  // 0-100, only meaningful for OCR'd images — tesseract reports its own
  // confidence in recognizing the text, which is real signal for the
  // processing-quality score (a low-confidence OCR result is exactly the
  // kind of thing worth flagging for a second look, not just "extraction
  // succeeded"). Undefined for every other extraction path, which has no
  // equivalent confidence signal to report.
  ocrConfidence?: number;
}

export async function extractDocumentText(
  fileName: string,
  storagePath: string,
): Promise<ExtractionResult | null> {
  const buffer = await readPlaintextFile(storagePath);

  if (hasExtension(fileName, PLAIN_TEXT_EXTENSIONS)) {
    return { text: buffer.toString("utf-8") };
  }

  if (hasExtension(fileName, PDF_EXTENSIONS)) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      // getTable() detects tables from vector grid lines drawn on the page
      // — heuristic, so failures here are swallowed rather than breaking
      // extraction of the (already-successful) plain text.
      const tablesByPage = await parser.getTable().catch(() => null);
      // Page markers let the model cite a specific page (e.g. "(file.pdf, p. 4)")
      // instead of just the filename — see citationCheck.ts, which parses this
      // format back out to verify the citation.
      const text = result.pages
        .map((page) => {
          const tables = tablesByPage?.pages.find((t) => t.num === page.num)?.tables ?? [];
          const tablesText = tables.map((rows) => renderMarkdownTable(rows)).join("\n\n");
          return `[Page ${page.num}]\n${page.text}${tablesText ? `\n\n${tablesText}` : ""}`;
        })
        .join("\n\n");
      return { text };
    } finally {
      await parser.destroy();
    }
  }

  if (hasExtension(fileName, DOCX_EXTENSIONS)) {
    const result = await mammoth.extractRawText({ buffer });
    const tables = await extractDocxTables(buffer).catch(() => []);
    const tablesText = tables.map((rows) => renderMarkdownTable(rows)).join("\n\n");
    return { text: tablesText ? `${result.value}\n\n${tablesText}` : result.value };
  }

  if (hasExtension(fileName, IMAGE_EXTENSIONS)) {
    const { data } = await recognize(buffer, "eng");
    return { text: data.text, ocrConfidence: data.confidence };
  }

  if (hasExtension(fileName, SPREADSHEET_EXTENSIONS)) {
    const workbook = read(buffer, { type: "buffer" });
    const text = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = utils.sheet_to_csv(sheet);
      return `Sheet: ${sheetName}\n${csv}`;
    }).join("\n\n");
    return { text };
  }

  if (hasExtension(fileName, AUDIO_VIDEO_EXTENSIONS)) {
    const text = await transcribeAudio(buffer, fileName);
    return { text };
  }

  return null;
}
