import type { CaseNoteupRef } from "./types";

// Deliberately not a "is this still good law?" check — CanLII's citator API
// returns which cases cite the original, never HOW they treated it
// (affirmed/reversed/distinguished), and this app has no access to full
// case text to determine that itself. What it CAN honestly detect: a citing
// case whose title shares a distinctive party name with the original —
// often (not always) the same litigation on appeal. This is a "go check
// this one" flag, not a verdict.
//
// Kept in its own dependency-free module (only ./types, a pure type-only
// import) rather than living in caseNoteup.ts, which pulls in db/CanLII/
// settings — importing this from a client component (CaseNoteupPanel.tsx)
// must not drag that whole server-only module graph into the browser
// bundle, the exact bug hit earlier with AiProviderMatrix.tsx.
const GENERIC_PARTY_TERMS = new Set([
  "r",
  "her",
  "majesty",
  "the",
  "queen",
  "king",
  "hmtq",
  "hmk",
  "attorney",
  "general",
  "ag",
  "crown",
  "of",
  "and",
  "et",
  "al",
  "ontario",
  "canada",
]);

function distinctivePartyWords(title: string): string[] {
  return title
    .toLowerCase()
    .split(/\s+v\.?\s+/i)
    .flatMap((side) => side.split(/[^a-z0-9]+/))
    .filter((word) => word.length > 2 && !GENERIC_PARTY_TERMS.has(word));
}

export function findPossibleAppeals(originalTitle: string, citingCases: CaseNoteupRef[]): CaseNoteupRef[] {
  const originalWords = new Set(distinctivePartyWords(originalTitle));
  if (originalWords.size === 0) return [];
  return citingCases.filter((c) => distinctivePartyWords(c.title).some((word) => originalWords.has(word)));
}
