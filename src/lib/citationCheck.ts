// Matches "(filename.ext)" or "(filename.ext, p. 4)" — the page suffix is
// optional since only PDFs carry page markers (see textExtraction.ts).
const CITATION_PATTERN = /\(([^()]+\.[a-zA-Z0-9]{2,5})(?:,\s*p\.?\s*(\d+))?\)/g;

export interface ParsedCitation {
  filename: string;
  page: number | null;
}

export function extractCitations(text: string): ParsedCitation[] {
  const matches = [...text.matchAll(CITATION_PATTERN)];
  const seen = new Set<string>();
  const citations: ParsedCitation[] = [];
  for (const match of matches) {
    const filename = match[1].trim();
    const page = match[2] ? Number(match[2]) : null;
    const key = `${filename}|${page ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ filename, page });
  }
  return citations;
}

export function extractCitedFilenames(text: string): string[] {
  return [...new Set(extractCitations(text).map((c) => c.filename))];
}

export interface CitationCheck {
  filename: string;
  page: number | null;
  verified: boolean;
}

export function verifyCitations(text: string, knownFilenames: string[]): CitationCheck[] {
  const known = new Set(knownFilenames);
  return extractCitations(text).map(({ filename, page }) => ({
    filename,
    page,
    verified: known.has(filename),
  }));
}
