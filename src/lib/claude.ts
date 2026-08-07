import Anthropic from "@anthropic-ai/sdk";
import { completeJSONWithOpenAI, completeWithOpenAI } from "./openaiText";
import { completeGemini, completeJSONGemini } from "./gemini";
import { completeJSONOllama, completeOllama } from "./ollama";
import { MODEL_IDS, type ModelTier } from "./modelTiers";
import {
  getAiProviderOrder,
  getAnthropicApiKey,
  getGeminiApiKey,
  getOllamaConfig,
  getOpenaiApiKey,
} from "./settings";
import type { AiProvider } from "./settings";
import type { DraftType, MatterClassification } from "./types";

let cachedKey: string | null = null;
let cachedClient: Anthropic | null = null;

async function getClient(): Promise<Anthropic> {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    throw new Error("No Anthropic API key configured. Add one in Settings.");
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new Anthropic({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

async function completeAnthropic(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  tier?: ModelTier;
}): Promise<string> {
  const client = await getClient();
  const response = await client.messages.create({
    model: MODEL_IDS.anthropic[params.tier ?? "capable"],
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: params.messages,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock?.text) {
    // Not thrown by the SDK — a "successful" response with no text block
    // (observed on very large inputs, e.g. a matter with many/large
    // documents). Must throw here, not return "", or forEachConfiguredProvider
    // treats this as a completed success and never tries the next provider
    // — the caller ends up silently persisting an empty result instead of
    // getting an error or a real fallback attempt.
    throw new Error("The AI returned an empty response. Try regenerating.");
  }
  return textBlock.text;
}

// Uses structured-output mode (json_schema) instead of asking for JSON in
// prose and hoping the model complies — a prompt-only "respond with ONLY a
// JSON array" instruction is not reliably followed and produced parse
// failures in practice (markdown fences, stray prose). Structured outputs
// constrain the response to the given schema server-side.
async function completeJSONAnthropic<T>(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: Record<string, unknown>;
  maxTokens?: number;
  tier?: ModelTier;
}): Promise<T> {
  const client = await getClient();
  const response = await client.messages.create({
    model: MODEL_IDS.anthropic[params.tier ?? "capable"],
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: params.messages,
    output_config: { format: { type: "json_schema", schema: params.schema } },
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock?.text) {
    throw new Error("The AI returned an empty response. Try regenerating.");
  }
  try {
    return JSON.parse(textBlock.text) as T;
  } catch {
    // A raw JSON.parse SyntaxError ("Unterminated string in JSON at
    // position N") is meaningless to a user — this specific failure mode
    // means the response was cut off mid-structure, almost always because
    // maxTokens was too small for how much content this generated (seen
    // for real on a large matter's evidence graph).
    throw new Error(
      "The AI's response was cut off before finishing — try regenerating. If it keeps happening, this matter may have too much content for one pass.",
    );
  }
}

async function isProviderConfigured(provider: AiProvider): Promise<boolean> {
  if (provider === "anthropic") return Boolean(await getAnthropicApiKey());
  if (provider === "openai") return Boolean(await getOpenaiApiKey());
  if (provider === "gemini") return Boolean(await getGeminiApiKey());
  return Boolean(await getOllamaConfig());
}

// Tries each configured provider in the user's chosen order (Settings > AI
// model), falling through to the next on any failure (billing, rate limit,
// outage) so a single provider going down doesn't take the app down with it.
// Providers with no key at all are skipped unless none are configured, in
// which case the first provider's natural "no key configured" error surfaces
// (preserves the original single-provider error message when nothing is set
// up yet).
async function forEachConfiguredProvider<T>(
  attempt: (provider: AiProvider) => Promise<T>,
): Promise<T> {
  const order = await getAiProviderOrder();
  const configured: AiProvider[] = [];
  for (const provider of order) {
    if (await isProviderConfigured(provider)) configured.push(provider);
  }
  const attemptOrder = configured.length > 0 ? configured : order;

  const failures: { provider: AiProvider; error: unknown }[] = [];
  for (const provider of attemptOrder) {
    try {
      return await attempt(provider);
    } catch (err) {
      failures.push({ provider, error: err });
    }
  }

  // Only one provider was ever tried — surface its real error as-is
  // (preserves its specific error type, e.g. Anthropic.APIError, so
  // route-level handling like aiErrorResponse still gets the right status
  // code) instead of wrapping a single failure in a generic message.
  if (failures.length === 1) throw failures[0].error;

  // Multiple providers were tried and ALL failed — combine every provider's
  // real reason into one message. Without this, only the LAST provider's
  // error ever surfaced, which could hide a more actionable earlier failure
  // (e.g. Anthropic's "credit balance too low" hidden behind Gemini's
  // rate-limit message just because Gemini happened to be tried last).
  const combined = failures
    .map(({ provider, error }) => `${provider}: ${error instanceof Error ? error.message : String(error)}`)
    .join(" | ");
  throw new Error(`All configured AI providers failed. ${combined}`);
}

async function complete(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  tier?: ModelTier;
}): Promise<string> {
  return forEachConfiguredProvider((provider) => {
    if (provider === "anthropic") return completeAnthropic(params);
    if (provider === "openai") return completeWithOpenAI(params);
    if (provider === "gemini") return completeGemini(params);
    return completeOllama(params);
  });
}

async function completeJSON<T>(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
  tier?: ModelTier;
}): Promise<T> {
  return forEachConfiguredProvider((provider) => {
    if (provider === "anthropic") return completeJSONAnthropic<T>(params);
    if (provider === "openai") return completeJSONWithOpenAI<T>(params);
    if (provider === "gemini") return completeJSONGemini<T>(params);
    return completeJSONOllama<T>(params);
  });
}

export async function askClaude(params: {
  question: string;
  context: string;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const { question, context, history } = params;

  const system = context
    ? `You are a legal assistant answering questions about a specific matter. Base your answer only on the following matter documents. Cite the source filename in parentheses after any fact you draw from a document — if the source text has page markers (e.g. "[Page 4]"), include the page too, like "(file.pdf, p. 4)". If the documents don't contain enough information to answer, say so explicitly rather than guessing.\n\n${context}`
    : "You are a legal assistant. No documents have been uploaded for this matter yet, so say you have no source material to cite and answer only in general terms.";

  return complete({
    system,
    messages: [...history, { role: "user", content: question }],
    maxTokens: 2048,
  });
}

export interface MatterDocumentSection {
  label: string;
  text: string;
}

// Comfortably under every configured provider's real limit — Anthropic's is
// the highest of the three at 1M tokens, OpenAI's and Gemini's free tier are
// both far lower. A matter whose full text exceeds this switches to
// per-document summarization (below) instead of one giant prompt, so a
// large real matter degrades gracefully instead of failing outright on
// every provider (confirmed live: a 37-document, ~1.6M-token matter failed
// digest generation on Anthropic, OpenAI, AND Gemini before this existed).
const MAP_REDUCE_THRESHOLD_CHARS = 500_000;
// Bounded concurrency for the per-document summarization pass — a matter
// with dozens of documents firing that many simultaneous AI calls at once
// would trip a provider's own per-minute rate limit (confirmed against
// Gemini's free-tier quota in practice).
const MAP_REDUCE_BATCH_SIZE = 5;

function joinSections(sections: MatterDocumentSection[]): string {
  return sections.map((s) => `--- ${s.label} ---\n${s.text}`).join("\n\n");
}

async function summarizeSectionForMatterContext(section: MatterDocumentSection): Promise<string> {
  try {
    const summary = await complete({
      system:
        "You are extracting the key facts from ONE document, as an intermediate step before it's combined with other documents' summaries into a full analysis. List, in your own concise words (not a copy of the text): parties/people named, key dates, key facts/claims/admissions, and evidence described. If this document isn't substantively relevant (e.g. a blank cover sheet), say so in one line instead of padding.",
      messages: [{ role: "user", content: `Document: ${section.label}\n\n${section.text}` }],
      maxTokens: 700,
      // Fires once per document on a large matter (potentially dozens of
      // calls) — a fast/cheap model for this per-document extraction step,
      // saving the capable/expensive one for the final synthesis call that
      // actually needs real legal reasoning across all of them.
      tier: "fast",
    });
    return `--- ${section.label} (summarized) ---\n${summary}`;
  } catch (err) {
    return `--- ${section.label} ---\n[Could not summarize this document: ${err instanceof Error ? err.message : "unknown error"}]`;
  }
}

// Every "full corpus" AI feature (digest, evidence matrix, deadlines,
// drafts, email drafts) needs comprehensive coverage of every document —
// there's no query to retrieve "the relevant parts" against, unlike chat
// (see getMatterChatContext, which uses real retrieval instead). For a
// matter small enough to fit in one prompt this just joins everything, same
// as before this existed. Past the threshold, summarizing each document
// first keeps every document genuinely represented in the final answer
// instead of the request just failing.
export async function buildMatterContext(sections: MatterDocumentSection[]): Promise<string> {
  if (sections.length === 0) return "";
  const full = joinSections(sections);
  if (full.length <= MAP_REDUCE_THRESHOLD_CHARS) return full;

  const summaries: string[] = [];
  for (let i = 0; i < sections.length; i += MAP_REDUCE_BATCH_SIZE) {
    const batch = sections.slice(i, i + MAP_REDUCE_BATCH_SIZE);
    summaries.push(...(await Promise.all(batch.map(summarizeSectionForMatterContext))));
  }
  return summaries.join("\n\n");
}

export async function generateMatterDigest(sections: MatterDocumentSection[]): Promise<string> {
  const system = `You are a legal assistant producing an executive matter digest for a lawyer. Base every statement only on the provided matter documents — never invent facts, parties, or dates. Cite the source filename in parentheses after any fact you draw from a document — if the source text has page markers (e.g. "[Page 4]"), include the page too, like "(file.pdf, p. 4)". Structure your answer in these sections, using "Not stated in the provided documents" for anything you cannot support:

## Executive summary
## Parties
## Key dates
## Facts (agreed, disputed, unknown)
## Evidence inventory
## Missing documents / open questions`;

  if (sections.length === 0) {
    return "No documents have been uploaded for this matter yet — upload documents first, then generate a digest.";
  }

  const context = await buildMatterContext(sections);
  return complete({
    system,
    messages: [
      {
        role: "user",
        content: `Here are the matter documents:\n\n${context}\n\nProduce the digest.`,
      },
    ],
    // 2048 was too small for a real, data-rich matter — the model's output
    // got cut off with no visible text at all (see the empty-digest bug
    // this session), so it's bumped generously here rather than just
    // detecting the failure better.
    maxTokens: 4096,
  });
}

export interface ExtractedDeadline {
  description: string;
  dueDate: string | null;
  sourceDocument: string | null;
}

const DEADLINES_SCHEMA = {
  type: "object",
  properties: {
    deadlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          dueDate: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "ISO 8601 date (e.g. 2027-03-05), or null if unclear",
          },
          sourceDocument: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "The filename this deadline came from, or null",
          },
        },
        required: ["description", "dueDate", "sourceDocument"],
        additionalProperties: false,
      },
    },
  },
  required: ["deadlines"],
  additionalProperties: false,
};

export async function extractDeadlines(sections: MatterDocumentSection[]): Promise<ExtractedDeadline[]> {
  if (sections.length === 0) return [];

  const system = `You extract deadlines and important dates from legal matter documents. Only include dates that represent a genuine deadline, court date, limitation period, or similarly actionable date — not every date mentioned. If a date is mentioned but not clearly formatted, set dueDate to null and describe it in the description. If the same real-world deadline is mentioned in more than one document (e.g. the same court date cited in two different letters), list it only once — don't repeat it per source document. If there are no such dates, return an empty list.`;

  const context = await buildMatterContext(sections);
  const result = await completeJSON<{ deadlines: ExtractedDeadline[] }>({
    system,
    messages: [
      {
        role: "user",
        content: `Here are the matter documents:\n\n${context}\n\nExtract the deadlines.`,
      },
    ],
    schema: DEADLINES_SCHEMA,
    schemaName: "deadlines",
    maxTokens: 2048,
    // Extraction against a well-defined schema, not open-ended legal
    // reasoning — a lower-cost model with structured output is exactly
    // what the original architecture doc's routing table recommends here.
    tier: "fast",
  });

  return result.deadlines ?? [];
}

const DEFENCE_STRATEGY_SYSTEM = `You are a legal assistant preparing a defence strategy memo for a lawyer's review — not a final strategy, a first-pass analysis to work from. Base every claim on the provided matter documents — cite the source filename in parentheses after any fact you draw from a document, and the page too if the source has page markers (e.g. "[Page 4]"), like "(file.pdf, p. 4)". Structure your answer as:

## Prosecution/opposing case summary
## Weaknesses and vulnerabilities in the opposing case (evidentiary gaps, credibility issues, procedural defects)
## Viable defence theories, ranked by how well the documents support each
## Evidentiary or procedural issues worth raising (e.g. disclosure gaps, chain-of-custody, admissibility)
## Recommended next investigative steps

Use "Not stated in the provided documents" for anything you cannot support — never invent facts, witnesses, or evidence to strengthen a theory. Do not predict an outcome or estimate a probability of success. This is a strategic starting point for the lawyer, not advice to rely on directly.`;

const FACTUM_SYSTEM = `You are a legal assistant preparing a first-draft factum (written argument for the court) for a lawyer's review — never a final, filing-ready document. Base every factual assertion on the provided matter documents — cite the source filename in parentheses after any fact you draw from a document, and the page too if the source has page markers (e.g. "[Page 4]"), like "(file.pdf, p. 4)". Structure your answer as:

## Part I — Overview
## Part II — Statement of facts (numbered paragraphs, each cited to a source document; mark any fact not clearly supported as "[NEEDS LAWYER INPUT/VERIFICATION]")
## Part III — Issues
## Part IV — Argument (organized by issue; cite legal authority only if it was provided in the matter's own documents/reference library — never invent a case citation or statutory provision)
## Part V — Order sought

Clearly separate verified fact, client instruction, allegation, and inference throughout. This is a drafting aid, not a substitute for the lawyer's own legal research or final review.`;

const MOTION_SYSTEM = `You are a legal assistant preparing first-draft motion materials for a lawyer's review — never final or filing-ready. Base every fact on the provided matter documents, citing the source filename (and page, if available) after each fact drawn from one. Structure your answer as:

## Notice of motion — relief sought
## Grounds for the motion
## Supporting affidavit outline (numbered fact paragraphs the affidavit should cover, each tied to a source document; note where a fact would need the affiant's own first-hand knowledge rather than a document)
## Draft order sought

Never invent a procedural rule, filing deadline, or court form requirement not stated in the matter's own documents — mark it "[NEEDS LAWYER VERIFICATION — confirm current court rules]" instead.`;

const AFFIDAVIT_SYSTEM = `You are a legal assistant preparing a first-draft affidavit for a lawyer's and the affiant's review — never a final, sworn, or filing-ready document. An affidavit states facts within the affiant's own personal knowledge, in first person, numbered paragraphs — it is not argument, submission, or legal analysis, and must not include any. For every paragraph, cite which matter document it's drawn from in a trailing bracket, e.g. "(Source: file.pdf, p. 4)" — the affiant must be able to verify each fact is something they actually know first-hand, not something the documents merely assert. Structure:

1. Introductory paragraph (affiant's name, role/relationship to the matter, basis of knowledge)
2. Numbered factual paragraphs, chronological where possible
3. A closing paragraph reserved for swearing/affirmation (leave as "[TO BE COMPLETED ON SIGNING]")

Never draft a paragraph asserting something as the affiant's personal knowledge if the source document doesn't actually establish that — mark it "[NEEDS LAWYER INPUT — verify affiant has first-hand knowledge of this]" instead of guessing.`;

const CROSS_EXAM_SYSTEM = `You are a legal assistant preparing a first-draft cross-examination outline for a lawyer's review — a set of question AREAS and lines of inquiry, not verbatim questions to read off. Base it only on inconsistencies, admissions, or gaps genuinely present in the provided matter documents — cite the source filename (and page, if available) supporting each line of inquiry. Structure your answer as:

## Witness/party being examined and their role
## Prior statements to test (each with a source citation and what about it is being tested — inconsistency, gap, or omission)
## Suggested lines of inquiry, grouped by topic, each grounded in a specific document
## Anticipated difficulties or limits (e.g. the documents don't establish X, so this line of inquiry may need independent confirmation first)

Never invent a prior statement, inconsistency, or admission that isn't actually in the documents — this is exactly the kind of fabrication that damages credibility if used unprepared.`;

const DISCLOSURE_REQUEST_SYSTEM = `You are a legal assistant preparing a first-draft disclosure request letter for a lawyer's review. Base it on what the matter's own documents show has already been produced versus what appears to be missing or referenced-but-not-provided — cite the source filename for anything you're comparing against. Structure your answer as:

## Summary of disclosure received to date (with source citations)
## Specific items requested, each with a brief reason tied to something in the record (e.g. "referenced in [file] but not itself provided")
## Any statutory/procedural disclosure obligation being invoked — ONLY if it's stated in the matter's own documents; otherwise write "[NEEDS LAWYER INPUT — confirm applicable disclosure obligation]"

Never assert an item is missing just because it seems generically relevant to a case like this — ground every request in something specific already in the record.`;

const DRAFT_SYSTEM_PROMPTS: Partial<Record<DraftType, string>> = {
  "Defence strategy memo": DEFENCE_STRATEGY_SYSTEM,
  Factum: FACTUM_SYSTEM,
  "Motion materials": MOTION_SYSTEM,
  "Affidavit (first draft)": AFFIDAVIT_SYSTEM,
  "Cross-examination outline": CROSS_EXAM_SYSTEM,
  "Disclosure request": DISCLOSURE_REQUEST_SYSTEM,
};

export function buildDraftSystemPrompt(draftType: DraftType): string {
  return (
    DRAFT_SYSTEM_PROMPTS[draftType] ??
    `You are a legal assistant drafting a ${draftType.toLowerCase()} for a lawyer's review. Base every fact on the provided matter documents — cite the source filename in parentheses after any fact you draw from a document — if the source text has page markers (e.g. "[Page 4]"), include the page too, like "(file.pdf, p. 4)". Clearly distinguish verified fact from inference. This is a first draft only, explicitly for lawyer review before use — do not present it as final or ready to send. If the documents don't contain enough information for part of the draft, write "[NEEDS LAWYER INPUT: ...]" rather than inventing content.`
  );
}

export function buildDraftUserPrompt(draftType: DraftType, context: string, instructions: string): string {
  const contextSection = context
    ? `Matter documents:\n\n${context}\n\n`
    : "No documents have been uploaded for this matter yet.\n\n";
  return `${contextSection}Draft a ${draftType.toLowerCase()}. ${instructions || ""}`.trim();
}

export async function generateDraft(
  draftType: DraftType,
  sections: MatterDocumentSection[],
  instructions: string,
): Promise<string> {
  const context = await buildMatterContext(sections);
  return complete({
    system: buildDraftSystemPrompt(draftType),
    messages: [{ role: "user", content: buildDraftUserPrompt(draftType, context, instructions) }],
    maxTokens: 4096,
  });
}

export interface EmailDraft {
  subject: string;
  body: string;
}

export async function generateEmailDraft(
  sections: MatterDocumentSection[],
  instructions: string,
): Promise<EmailDraft> {
  const system = `You are a legal assistant drafting an email to a client on a lawyer's behalf, for the lawyer's review before sending — never send anything yourself, this is a first draft only. Base every fact on the provided matter documents — cite the source filename in parentheses after any fact you draw from a document. Keep the tone professional and appropriately concise for a client email, not a formal memo. Respond in exactly this format, with nothing before or after it:
Subject: <subject line>

<email body>`;

  const context = await buildMatterContext(sections);
  const contextSection = context
    ? `Matter documents:\n\n${context}\n\n`
    : "No documents have been uploaded for this matter yet.\n\n";

  const raw = await complete({
    system,
    messages: [
      {
        role: "user",
        content: `${contextSection}Draft a client email. ${instructions || ""}`.trim(),
      },
    ],
    maxTokens: 2048,
  });

  const match = raw.match(/^Subject:\s*(.+?)\n+([\s\S]*)$/);
  if (!match) return { subject: "", body: raw.trim() };
  return { subject: match[1].trim(), body: match[2].trim() };
}

export async function generateEvidenceMatrix(sections: MatterDocumentSection[]): Promise<string> {
  const system = `You are a legal assistant building an evidence-mapping matrix for a lawyer. Base every statement only on the provided matter documents — never invent allegations, evidence, or elements. Cite the source filename in parentheses after any fact you draw from a document — if the source text has page markers (e.g. "[Page 4]"), include the page too, like "(file.pdf, p. 4)". Structure your answer as:

## Allegations / claims / charges
## Elements to be proven (for each allegation/charge)
## Supporting evidence (mapped to each element, with source citations)
## Evidentiary gaps (elements with no supporting evidence in the provided documents)
## Possible defences or counterarguments suggested by the documents

Use "Not stated in the provided documents" for anything you cannot support. Do not predict an outcome or assign a probability of success — only map what is and isn't supported by the record.`;

  if (sections.length === 0) {
    return "No documents have been uploaded for this matter yet — upload documents first, then generate the matrix.";
  }

  const context = await buildMatterContext(sections);
  return complete({
    system,
    messages: [
      {
        role: "user",
        content: `Here are the matter documents:\n\n${context}\n\nProduce the evidence matrix.`,
      },
    ],
    maxTokens: 4096,
  });
}

// Comprehensive analysis needing every document read together, same
// category as digest/evidence-matrix — not a query to retrieve "the
// relevant parts" against, so it routes through buildMatterContext for the
// same map-reduce fallback on a large matter.
export async function generateContradictionAnalysis(sections: MatterDocumentSection[]): Promise<string> {
  const system = `You are a legal assistant comparing statements across a matter's documents (witness statements, correspondence, reports) to find genuine inconsistencies. Base every finding only on the provided matter documents — cite the source filename in parentheses after any fact you draw from a document, and the page too if the source has page markers (e.g. "[Page 4]"), like "(file.pdf, p. 4)". Structure your answer as:

## Witnesses/sources compared
## Date inconsistencies (same event, conflicting dates across sources)
## Location inconsistencies
## Amount/quantity inconsistencies
## Identity/description inconsistencies
## Other contradictory statements (same fact asserted and denied, or described differently)

For each finding, quote or closely paraphrase both conflicting statements with their sources, and describe the nature of the conflict — don't speculate about which one is correct or why the discrepancy exists. If no genuine inconsistencies are found in a category, say so rather than manufacturing a marginal one. Do not treat normal variation (different levels of detail, different wording of the same fact) as a contradiction.`;

  if (sections.length === 0) {
    return "No documents have been uploaded for this matter yet — upload documents first, then generate this analysis.";
  }

  const context = await buildMatterContext(sections);
  return complete({
    system,
    messages: [
      { role: "user", content: `Here are the matter documents:\n\n${context}\n\nFind contradictions and inconsistencies.` },
    ],
    maxTokens: 4096,
  });
}

export async function generateExhibitList(sections: MatterDocumentSection[]): Promise<string> {
  const system = `You are a legal assistant building an exhibit list from a matter's documents — the kind used to organize evidence for a hearing or trial. Base every entry only on the provided matter documents — cite the source filename in parentheses. Structure your answer as a numbered list, each entry with:

- **Exhibit description** — what it is, in plain terms
- **Source document** — the filename (and page, if available)
- **Relevance** — what allegation, fact, or issue it goes to support

Only list items that are genuinely distinct pieces of evidence (a document, photograph, recording, or physical item described in the documents) — not every document is necessarily its own exhibit if several belong together (e.g. a chain of emails). Use "[NEEDS LAWYER INPUT]" for an item whose exact exhibit status or admissibility is unclear from the documents alone.`;

  if (sections.length === 0) {
    return "No documents have been uploaded for this matter yet — upload documents first, then generate an exhibit list.";
  }

  const context = await buildMatterContext(sections);
  return complete({
    system,
    messages: [{ role: "user", content: `Here are the matter documents:\n\n${context}\n\nBuild the exhibit list.` }],
    maxTokens: 4096,
  });
}

export async function generateDisclosureChecklist(sections: MatterDocumentSection[]): Promise<string> {
  const system = `You are a legal assistant reviewing a matter's documents for disclosure completeness — comparing what's actually been provided against what the documents themselves reference as existing. Base every item only on the provided matter documents — cite the source filename in parentheses for both what's received and what's referenced-but-missing. Structure your answer as:

## Disclosure received (grouped by category — e.g. police reports, medical records, correspondence — with source citations)
## Referenced but not yet provided (something a document mentions exists — a report, a recording, an attachment — that isn't itself among the uploaded documents, with a citation to where it's referenced)
## Open questions about completeness (anything unclear about whether disclosure is complete, without speculating)

Never assume something is missing just because it would typically exist in a case like this — only list an item here if a document in the matter actually references it existing.`;

  if (sections.length === 0) {
    return "No documents have been uploaded for this matter yet — upload documents first, then generate a disclosure checklist.";
  }

  const context = await buildMatterContext(sections);
  return complete({
    system,
    messages: [
      { role: "user", content: `Here are the matter documents:\n\n${context}\n\nProduce the disclosure-completeness checklist.` },
    ],
    maxTokens: 4096,
  });
}

// Deliberately framed as "plausible positions with evidence and confidence"
// per the architecture doc's explicit guidance — never "the Crown will
// withdraw" or a bare probability. This is the one generator in this file
// with a hardcoded refusal-style instruction against outcome prediction
// baked into the system prompt itself, not just relying on the model's
// general good judgment, given how easily this specific analysis type
// could slide into exactly the kind of statement the doc warns against.
export async function generateCrownPositionAnalysis(sections: MatterDocumentSection[]): Promise<string> {
  const system = `You are a legal assistant analyzing the Crown's likely position in a criminal matter, for defence counsel's review. Base every statement only on the provided matter documents — cite the source filename in parentheses, and the page if available. Structure your answer as:

## Charges and statutory elements
## Available evidence for each element (with source citations)
## Evidentiary weaknesses or gaps
## Possible defences suggested by the record
## Similar considerations from any case law or Crown policy documents actually present in the matter's own materials (not from general knowledge)
## Aggravating and mitigating factors present in the record
## Questions counsel should investigate further

Then, as a final section:
## Plausible Crown positions
List two or three plausible Crown positions (e.g. proceed to trial on all counts, offer a resolution, withdraw a specific charge) — for each, state the evidence supporting it, what's missing, and your confidence level (high/medium/low) with a one-line reason. Do NOT state which one will happen, do NOT give a percentage or numeric probability, and do NOT present any of this as legal advice or a final assessment — this is a structured starting point for the lawyer's own judgment, explicitly not a prediction.`;

  if (sections.length === 0) {
    return "No documents have been uploaded for this matter yet — upload documents first, then generate this analysis.";
  }

  const context = await buildMatterContext(sections);
  return complete({
    system,
    messages: [
      { role: "user", content: `Here are the matter documents:\n\n${context}\n\nAnalyze the Crown's likely position.` },
    ],
    maxTokens: 4096,
  });
}

async function scanDocumentForPrivilegeAndPii(section: MatterDocumentSection): Promise<string> {
  const system = `You are reviewing ONE document from a legal matter for privilege and sensitive-content concerns, as part of a review before the document might be disclosed externally. Identify: (1) passages that appear to be solicitor-client privileged communications or litigation work product; (2) sensitive personal information beyond standard identifiers (SIN/SSN/credit card numbers, phone numbers, and email addresses are already handled separately — don't repeat those) — e.g. medical or psychiatric details, financial account specifics, information about a minor, immigration status, or similarly sensitive personal detail. For each finding, quote the exact passage verbatim (so it can be located and redacted) and give a one-line reason tagged [PRIVILEGE] or [SENSITIVE]. If nothing of concern is found in this document, say so in one line — don't manufacture a marginal finding just to have something to report.`;
  try {
    const result = await complete({
      system,
      messages: [{ role: "user", content: `Document: ${section.label}\n\n${section.text}` }],
      maxTokens: 1024,
      // Classification/flagging against a well-defined rubric, not open-ended
      // legal reasoning — the routing table's case for a lower-cost model.
      tier: "fast",
    });
    return `### ${section.label}\n${result}`;
  } catch (err) {
    return `### ${section.label}\n[Could not review this document: ${err instanceof Error ? err.message : "unknown error"}]`;
  }
}

// Deliberately NOT routed through buildMatterContext's map-reduce fallback
// — that summarizes documents for size management, which would lose the
// exact wording a redaction suggestion needs to quote verbatim. Privilege
// review is inherently a per-document task anyway (unlike digest/Crown-
// position, which need everything read together), so every document gets
// its own direct scan regardless of matter size — bounded concurrency, same
// batching approach as the map-reduce step, to avoid tripping a provider's
// per-minute rate limit.
const PRIVILEGE_REVIEW_BATCH_SIZE = 5;

export async function generatePrivilegeReview(sections: MatterDocumentSection[]): Promise<string> {
  if (sections.length === 0) {
    return "No documents have been uploaded for this matter yet — upload documents first, then generate this review.";
  }

  const findings: string[] = [];
  for (let i = 0; i < sections.length; i += PRIVILEGE_REVIEW_BATCH_SIZE) {
    const batch = sections.slice(i, i + PRIVILEGE_REVIEW_BATCH_SIZE);
    findings.push(...(await Promise.all(batch.map(scanDocumentForPrivilegeAndPii))));
  }
  return `# Privilege & Redaction Review\n\nEach document below was reviewed individually. Quoted passages are candidates for redaction before external disclosure — review before acting, this is not a final privilege determination.\n\n${findings.join("\n\n")}`;
}

export interface EvidenceGraphNode {
  id: string;
  label: string;
  type: "party" | "allegation" | "evidence" | "gap";
}

export interface EvidenceGraphEdge {
  source: string;
  target: string;
  label: string | null;
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
}

const EVIDENCE_GRAPH_SCHEMA = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "short unique slug, e.g. 'evidence-1'" },
          label: { type: "string", description: "a few words, shown on the graph" },
          type: { type: "string", enum: ["party", "allegation", "evidence", "gap"] },
        },
        required: ["id", "label", "type"],
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          label: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "e.g. 'supports', 'alleges against', 'missing for' — or null",
          },
        },
        required: ["source", "target", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["nodes", "edges"],
  additionalProperties: false,
};

// Reformats an already-generated evidence matrix into graph data — this is
// a parsing/restructuring pass over that existing analysis, not a fresh
// extraction from the raw documents, so it doesn't introduce a second,
// possibly-inconsistent, AI reading of the source material.
export async function extractEvidenceGraph(matrixContent: string): Promise<EvidenceGraph> {
  const system = `You convert an already-generated legal evidence matrix into graph data for visualization. Do not invent any party, allegation, evidence, or relationship beyond what the matrix already states — this is a reformatting task, not a new analysis. Create one node per party/entity, per allegation/claim/charge, per distinct evidence item, and per evidentiary gap named in the matrix. Create an edge from each evidence node to the allegation it supports, from each party node to the allegation(s) involving them, and from each gap node to the allegation it's missing evidence for. Keep labels short (a few words).`;

  return completeJSON<EvidenceGraph>({
    system,
    messages: [
      {
        role: "user",
        content: `Here is the evidence matrix:\n\n${matrixContent}\n\nConvert it to graph data.`,
      },
    ],
    schema: EVIDENCE_GRAPH_SCHEMA,
    schemaName: "evidence_graph",
    // A real evidence matrix for a data-rich matter needs real headroom
    // for graph JSON — each node/edge carries a label plus structural
    // overhead, and 2048 was observed truncating mid-string on a real
    // matter (a JSON.parse "Unterminated string" failure), not just
    // running short on prose the way the plain-text generators above did.
    maxTokens: 8192,
  });
}

export interface DefenceGraphNode {
  id: string;
  label: string;
  type: "weakness" | "theory" | "issue" | "step";
}

export interface DefenceGraphEdge {
  source: string;
  target: string;
  label: string | null;
}

export interface DefenceGraph {
  nodes: DefenceGraphNode[];
  edges: DefenceGraphEdge[];
}

const DEFENCE_GRAPH_SCHEMA = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "short unique slug, e.g. 'weakness-1'" },
          label: { type: "string", description: "a few words, shown on the graph" },
          type: { type: "string", enum: ["weakness", "theory", "issue", "step"] },
        },
        required: ["id", "label", "type"],
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          label: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "e.g. 'supports', 'raises', 'needs' — or null",
          },
        },
        required: ["source", "target", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["nodes", "edges"],
  additionalProperties: false,
};

// Same approach as extractEvidenceGraph above: reformats an already-
// generated defence strategy memo into graph data, rather than a fresh
// extraction pass over the raw documents.
export async function extractDefenceGraph(memoContent: string): Promise<DefenceGraph> {
  const system = `You convert an already-generated defence strategy memo into graph data for visualization. Do not invent any weakness, theory, issue, or step beyond what the memo already states — this is a reformatting task, not a new analysis. Create one node per opposing-case weakness, per defence theory, per evidentiary/procedural issue, and per recommended next step named in the memo. Create an edge from each weakness to the defence theory it supports, from each theory to the evidentiary/procedural issue(s) it raises, from each theory to the step(s) needed to develop it, and from each issue to the step(s) needed to resolve or investigate it. Keep labels short (a few words).`;

  return completeJSON<DefenceGraph>({
    system,
    messages: [
      {
        role: "user",
        content: `Here is the defence strategy memo:\n\n${memoContent}\n\nConvert it to graph data.`,
      },
    ],
    schema: DEFENCE_GRAPH_SCHEMA,
    schemaName: "defence_graph",
    maxTokens: 8192,
  });
}

// Generic translation for any AI-generated output in this app (digests,
// evidence matrices, drafts, chat answers, independent reviews, email
// drafts) — not matter-specific, so it takes plain text/markdown rather
// than a matter context.
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const system = `You are a professional legal translator. Translate the user's text into ${targetLanguage}. Preserve the original structure exactly — markdown headings, bullet/numbered lists, bold/italic, and any parenthetical source citations like "(file.pdf, p. 4)" must remain in the same form and position, with the filename inside a citation left untranslated. Translate only the prose content itself. Do not summarize, shorten, add commentary, or explain your translation — output only the translated text, nothing else.`;

  return complete({
    system,
    messages: [{ role: "user", content: text }],
    maxTokens: 8192,
  });
}

const SENSITIVITY_SCHEMA = {
  type: "object",
  properties: {
    containsSensitiveContent: {
      type: "boolean",
      description:
        "True if the text contains a real client's personal information (names, addresses, phone numbers, financial/health/identity details tied to a real person) or content that reads as privileged/confidential to a specific matter, rather than being genuinely general reference material (a statute, a published case, a firm template with no real client's details).",
    },
    reason: {
      type: "string",
      description:
        "One sentence explaining what was found, or an empty string if containsSensitiveContent is false.",
    },
  },
  required: ["containsSensitiveContent", "reason"],
  additionalProperties: false,
};

// Reference-library documents are meant to be reused across many matters
// (statutes, precedents, published case law) — a document that's actually
// one client's personal/privileged material has no business being
// reusable that way. This is a flag for the human approver to weigh, not
// an automatic block: false positives (a case name that includes a real
// person's name, e.g. a party in published case law) are expected and
// normal, so the approver sees the reason and decides.
export async function scanReferenceDocumentForSensitiveContent(text: string): Promise<string | null> {
  if (!text.trim()) return null;

  const system = `You review documents being added to a law firm's shared reference library — material meant to be reusable across many clients' matters (statutes, published case law, firm templates, research memos with identifying details removed). Flag documents that instead look like one specific client's personal or privileged material, which shouldn't be reused across unrelated matters.`;

  const result = await completeJSON<{ containsSensitiveContent: boolean; reason: string }>({
    system,
    messages: [
      {
        role: "user",
        content: `Here is the document text (may be truncated):\n\n${text.slice(0, 20000)}`,
      },
    ],
    schema: SENSITIVITY_SCHEMA,
    schemaName: "sensitivity_scan",
    maxTokens: 512,
    tier: "fast",
  });

  return result.containsSensitiveContent ? result.reason : null;
}

const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    classification: {
      type: "string",
      enum: ["standard", "privileged", "highly-sensitive"],
      description:
        "\"privileged\" if the documents contain solicitor-client privileged communications or clear litigation work product; \"highly-sensitive\" if they contain content needing extra care beyond ordinary privilege — medical/psychiatric records, financial account details, information about a minor, or similar; \"standard\" if neither applies.",
    },
    reason: {
      type: "string",
      description: "One sentence explaining the suggestion, or why standard applies.",
    },
  },
  required: ["classification", "reason"],
  additionalProperties: false,
};

// Intake agent: reads a matter's own documents and suggests whether its
// classification should be tightened beyond the "standard" default a
// matter starts with — never auto-applied, just a suggestion for the
// lawyer to accept or dismiss (same pattern as the reference-library
// sensitivity scanner: flag, don't decide). Only ever suggests
// *tightening* — the caller only invokes this while a matter is still at
// the "standard" default, so there's no risk of this trying to loosen an
// existing privileged/highly-sensitive classification a lawyer already
// set deliberately.
export async function suggestMatterClassification(
  context: string,
): Promise<{ classification: MatterClassification; reason: string }> {
  const system = `You review a legal matter's documents to suggest whether its confidentiality classification should be tightened beyond the default. Be conservative — only suggest "privileged" or "highly-sensitive" when the documents clearly warrant it, not on a borderline guess.`;

  return completeJSON<{ classification: MatterClassification; reason: string }>({
    system,
    messages: [
      {
        role: "user",
        content: `Here are the matter's documents:\n\n${context}\n\nSuggest a classification.`,
      },
    ],
    schema: CLASSIFICATION_SCHEMA,
    schemaName: "classification_suggestion",
    maxTokens: 512,
    tier: "fast",
  });
}
