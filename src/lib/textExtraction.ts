import { readFile } from "fs/promises";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { recognize } from "tesseract.js";
import { read, utils } from "xlsx";

const PLAIN_TEXT_EXTENSIONS = [".txt", ".md"];
const PDF_EXTENSIONS = [".pdf"];
const DOCX_EXTENSIONS = [".docx"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const SPREADSHEET_EXTENSIONS = [".csv", ".xlsx", ".xls"];

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
  ].some((ext) => fileName.toLowerCase().endsWith(ext));
}

export async function extractDocumentText(
  fileName: string,
  storagePath: string,
): Promise<string | null> {
  if (hasExtension(fileName, PLAIN_TEXT_EXTENSIONS)) {
    return readFile(storagePath, "utf-8");
  }

  if (hasExtension(fileName, PDF_EXTENSIONS)) {
    const buffer = await readFile(storagePath);
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (hasExtension(fileName, DOCX_EXTENSIONS)) {
    const buffer = await readFile(storagePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (hasExtension(fileName, IMAGE_EXTENSIONS)) {
    const buffer = await readFile(storagePath);
    const { data } = await recognize(buffer, "eng");
    return data.text;
  }

  if (hasExtension(fileName, SPREADSHEET_EXTENSIONS)) {
    const buffer = await readFile(storagePath);
    const workbook = read(buffer, { type: "buffer" });
    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = utils.sheet_to_csv(sheet);
      return `Sheet: ${sheetName}\n${csv}`;
    }).join("\n\n");
  }

  return null;
}
