import { getCanliiApiKey } from "./settings";

const BASE_URL = "https://api.canlii.org/v1";

async function canliiFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const apiKey = await getCanliiApiKey();
  if (!apiKey) {
    throw new Error("CanLII API key not configured in Settings.");
  }
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`CanLII API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface CanliiCaseDatabase {
  databaseId: string;
  jurisdiction: string;
  name: string;
}

export async function listCaseDatabases(language: "en" | "fr" = "en"): Promise<CanliiCaseDatabase[]> {
  const data = await canliiFetch<{ caseDatabases: CanliiCaseDatabase[] }>(`/caseBrowse/${language}/`);
  return data.caseDatabases;
}

// Note: caseId comes back as a language-keyed object ({ en: "..." }) in list
// responses, but as a plain string on the individual case metadata endpoint.
// These are genuinely different shapes per CanLII's own documented examples
// — do not "normalize" one to match the other without re-checking.
export interface CanliiCaseSummary {
  databaseId: string;
  caseId: { en?: string; fr?: string };
  title: string;
  citation: string;
}

export async function listCasesInDatabase(
  databaseId: string,
  options: {
    language?: "en" | "fr";
    offset?: number;
    resultCount?: number;
    decisionDateAfter?: string;
    decisionDateBefore?: string;
  } = {},
): Promise<CanliiCaseSummary[]> {
  const language = options.language ?? "en";
  const data = await canliiFetch<{ cases: CanliiCaseSummary[] }>(
    `/caseBrowse/${language}/${databaseId}/`,
    {
      offset: options.offset ?? 0,
      resultCount: options.resultCount ?? 100,
      decisionDateAfter: options.decisionDateAfter,
      decisionDateBefore: options.decisionDateBefore,
    },
  );
  return data.cases;
}

export interface CanliiCaseMetadata {
  databaseId: string;
  caseId: string;
  url: string;
  title: string;
  citation: string;
  language?: string;
  docketNumber?: string;
  decisionDate?: string;
  keywords?: string;
  concatenatedId?: string;
}

export async function getCaseMetadata(
  databaseId: string,
  caseId: string,
  language: "en" | "fr" = "en",
): Promise<CanliiCaseMetadata> {
  return canliiFetch<CanliiCaseMetadata>(`/caseBrowse/${language}/${databaseId}/${caseId}/`);
}

export type CanliiCitatorType = "citedCases" | "citingCases" | "citedLegislations";

export async function getCaseCitator(
  databaseId: string,
  caseId: string,
  metadataType: CanliiCitatorType,
): Promise<CanliiCaseSummary[]> {
  const data = await canliiFetch<Record<CanliiCitatorType, CanliiCaseSummary[]>>(
    `/caseCitator/en/${databaseId}/${caseId}/${metadataType}`,
  );
  return data[metadataType];
}

export interface CanliiLegislationDatabase {
  databaseId: string;
  type: string;
  jurisdiction: string;
  name: string;
}

export async function listLegislationDatabases(
  language: "en" | "fr" = "en",
): Promise<CanliiLegislationDatabase[]> {
  const data = await canliiFetch<{ legislationDatabases: CanliiLegislationDatabase[] }>(
    `/legislationBrowse/${language}/`,
  );
  return data.legislationDatabases;
}

export interface CanliiLegislationMetadata {
  legislationId: string;
  url: string;
  title: string;
  citation: string;
  type?: string;
  language?: string;
  repealed?: boolean;
}

export async function getLegislationMetadata(
  databaseId: string,
  legislationId: string,
  language: "en" | "fr" = "en",
): Promise<CanliiLegislationMetadata> {
  return canliiFetch<CanliiLegislationMetadata>(
    `/legislationBrowse/${language}/${databaseId}/${legislationId}/`,
  );
}
