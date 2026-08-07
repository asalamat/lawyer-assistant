import { randomUUID } from "crypto";
import { type CanliiCitatorType, getCaseCitator, getCaseMetadata } from "./canlii";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import { getMatterTextContext } from "./matters";
import type { CaseNoteup, CaseNoteupRef } from "./types";

// Canadian neutral-citation court/tribunal abbreviations. CanLII's databaseId
// for a court is the lowercased abbreviation, and its caseId is the citation
// with the spaces stripped and lowercased (e.g. "2020 ONCA 123" -> onca /
// 2020onca123) — confirmed against the live API, not documented anywhere.
const COURT_ABBREVIATIONS = [
  "SCC", "FCA", "FC", "TCC", "CMAC",
  "ONCA", "ONSC", "ONCJ",
  "ABCA", "ABQB", "ABPC",
  "BCCA", "BCSC", "BCPC",
  "MBCA", "MBQB", "MBPC",
  "SKCA", "SKQB", "SKPC",
  "NSCA", "NSSC", "NSPC",
  "NBCA", "NBQB", "NBPC",
  "NLCA", "NLSC", "NLPC",
  "PECA", "PESC",
  "YKCA", "YKSC",
  "NWTCA", "NWTSC",
  "NUCA", "NUCJ",
];

const CITATION_PATTERN = new RegExp(
  `\\b((?:19|20)\\d{2})\\s+(${COURT_ABBREVIATIONS.join("|")})\\s+(\\d{1,5})\\b`,
  "gi",
);

export interface ParsedCaseCitation {
  citation: string;
  databaseId: string;
  caseId: string;
}

export function extractCaseCitations(text: string): ParsedCaseCitation[] {
  const seen = new Set<string>();
  const results: ParsedCaseCitation[] = [];
  for (const match of text.matchAll(CITATION_PATTERN)) {
    const [, year, court, number] = match;
    const databaseId = court.toLowerCase();
    const caseId = `${year}${databaseId}${number}`;
    if (seen.has(caseId)) continue;
    seen.add(caseId);
    results.push({ citation: `${year} ${court.toUpperCase()} ${number}`, databaseId, caseId });
  }
  return results;
}

// CanLII's API rate-limits well under 1 request/second in practice (observed
// 429s during testing) — note-up needs metadata plus three citator calls per
// citation, so these stay sequential with a pause between every call rather
// than parallelizing across citations.
const CANLII_REQUEST_GAP_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRefs(summaries: { title: string; citation: string }[]): CaseNoteupRef[] {
  return summaries.map((s) => ({ title: s.title, citation: s.citation }));
}

async function noteUpOne(matterId: string, parsed: ParsedCaseCitation): Promise<CaseNoteup> {
  const base = {
    id: randomUUID(),
    matterId,
    citation: parsed.citation,
    databaseId: parsed.databaseId,
    caseId: parsed.caseId,
    checkedAt: new Date().toISOString(),
  };

  let metadata;
  try {
    metadata = await getCaseMetadata(parsed.databaseId, parsed.caseId);
  } catch (err) {
    return {
      ...base,
      found: false,
      title: null,
      url: null,
      citedCases: [],
      citingCases: [],
      citedLegislations: [],
      error: err instanceof Error ? err.message : "Not found on CanLII",
    };
  }

  // CanLII's case-metadata endpoint accepts the citation abbreviation as a
  // databaseId alias (e.g. "scc", "fc", "tcc"), but its citator endpoint
  // 404s on those aliases and needs the canonical id the metadata response
  // reports back (e.g. "csc-scc", "fct", "cci-tcc") — confirmed against the
  // live API. parsed.databaseId is only ever safe to use for the metadata
  // call above; every call below must use metadata.databaseId instead.
  const citator = async (type: CanliiCitatorType): Promise<CaseNoteupRef[]> => {
    await sleep(CANLII_REQUEST_GAP_MS);
    try {
      return toRefs(await getCaseCitator(metadata.databaseId, parsed.caseId, type));
    } catch {
      // A citator sub-call failing shouldn't discard the metadata we already
      // have — this citation is still "found", just missing that one list.
      return [];
    }
  };

  return {
    ...base,
    found: true,
    title: metadata.title,
    url: metadata.url,
    citedCases: await citator("citedCases"),
    citingCases: await citator("citingCases"),
    citedLegislations: await citator("citedLegislations"),
    error: null,
  };
}

interface CaseNoteupRow {
  id: string;
  matterId: string;
  citation: string;
  databaseId: string;
  caseId: string;
  found: number;
  title: string | null;
  url: string | null;
  citedCasesJson: string;
  citingCasesJson: string;
  citedLegislationsJson: string;
  error: string | null;
  checkedAt: string;
}

function rowToNoteup(row: CaseNoteupRow): CaseNoteup {
  return {
    id: row.id,
    matterId: row.matterId,
    citation: row.citation,
    databaseId: row.databaseId,
    caseId: row.caseId,
    found: Boolean(row.found),
    title: row.title,
    url: row.url,
    citedCases: JSON.parse(row.citedCasesJson) as CaseNoteupRef[],
    citingCases: JSON.parse(row.citingCasesJson) as CaseNoteupRef[],
    citedLegislations: JSON.parse(row.citedLegislationsJson) as CaseNoteupRef[],
    error: row.error,
    checkedAt: row.checkedAt,
  };
}

export async function listCaseNoteups(matterId: string): Promise<CaseNoteup[]> {
  return db
    .prepare("SELECT * FROM case_noteups WHERE matterId = ? ORDER BY citation ASC")
    .all(matterId)
    .map((row) => rowToNoteup(toPlain<CaseNoteupRow>(row)));
}

// Full refresh, not an append — re-scans the matter's current documents/notes
// for citations and replaces whatever was stored before. There's no history
// here, only "as of the last check".
export async function refreshCaseNoteups(matterId: string): Promise<CaseNoteup[]> {
  const context = await getMatterTextContext(matterId);
  const citations = extractCaseCitations(context);

  const results: CaseNoteup[] = [];
  for (const parsed of citations) {
    if (results.length > 0) await sleep(CANLII_REQUEST_GAP_MS);
    results.push(await noteUpOne(matterId, parsed));
  }

  db.prepare("DELETE FROM case_noteups WHERE matterId = ?").run(matterId);
  const insert = db.prepare(
    "INSERT INTO case_noteups (id, matterId, citation, databaseId, caseId, found, title, url, citedCasesJson, citingCasesJson, citedLegislationsJson, error, checkedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const r of results) {
    insert.run(
      r.id,
      r.matterId,
      r.citation,
      r.databaseId,
      r.caseId,
      r.found ? 1 : 0,
      r.title,
      r.url,
      JSON.stringify(r.citedCases),
      JSON.stringify(r.citingCases),
      JSON.stringify(r.citedLegislations),
      r.error,
      r.checkedAt,
    );
  }

  if (results.length > 0) {
    await recordAuditEvent(
      "case_noteup_checked",
      matterId,
      `Checked ${results.length} case citation${results.length === 1 ? "" : "s"} against CanLII`,
    );
  }

  return results;
}
