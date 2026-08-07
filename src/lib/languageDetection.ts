import { franc } from "franc";

// Restricted to languages actually plausible for a Canadian legal practice's
// clients (the two official languages, plus the most common non-official
// languages per StatCan census data) — franc's unrestricted mode frequently
// misidentifies short/ambiguous English text as a minority language (e.g.
// Scots) that happens to share enough trigrams. Codes are ISO 639-3, what
// franc itself expects/returns.
const CANDIDATE_LANGUAGES = [
  "eng",
  "fra",
  "cmn",
  "spa",
  "pan",
  "tgl",
  "arb",
  "ita",
  "deu",
  "por",
  "vie",
  "kor",
  "pes",
  "urd",
  "tam",
  "rus",
  "pol",
  "ukr",
];

const LANGUAGE_NAMES: Record<string, string> = {
  eng: "English",
  fra: "French",
  cmn: "Mandarin Chinese",
  spa: "Spanish",
  pan: "Punjabi",
  tgl: "Tagalog",
  arb: "Arabic",
  ita: "Italian",
  deu: "German",
  por: "Portuguese",
  vie: "Vietnamese",
  kor: "Korean",
  pes: "Persian (Farsi)",
  urd: "Urdu",
  tam: "Tamil",
  rus: "Russian",
  pol: "Polish",
  ukr: "Ukrainian",
};

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

// franc needs a real sample to work from — too little text and its own
// "und" (undetermined) code is the honest answer, not a guess.
const MIN_TEXT_LENGTH = 20;

export function detectLanguage(text: string): string {
  if (!text || text.trim().length < MIN_TEXT_LENGTH) return "und";
  return franc(text, { only: CANDIDATE_LANGUAGES });
}
