const CITATION_PATTERN = /\(([^()]+\.[a-zA-Z0-9]{2,5})\)/g;

export function extractCitedFilenames(text: string): string[] {
  const matches = [...text.matchAll(CITATION_PATTERN)];
  return [...new Set(matches.map((m) => m[1].trim()))];
}

export interface CitationCheck {
  filename: string;
  verified: boolean;
}

export function verifyCitations(text: string, knownFilenames: string[]): CitationCheck[] {
  const known = new Set(knownFilenames);
  return extractCitedFilenames(text).map((filename) => ({
    filename,
    verified: known.has(filename),
  }));
}
