import Anthropic from "@anthropic-ai/sdk";
import { completeJSONWithOpenAI, completeWithOpenAI } from "./openaiText";
import { getAiProviderOrder, getAnthropicApiKey, getOpenaiApiKey } from "./settings";
import type { AiProvider } from "./settings";
import type { DraftType } from "./types";

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
}): Promise<string> {
  const client = await getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
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
}): Promise<T> {
  const client = await getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-5",
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
  return Boolean(provider === "anthropic" ? await getAnthropicApiKey() : await getOpenaiApiKey());
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

  let lastError: unknown;
  for (const provider of attemptOrder) {
    try {
      return await attempt(provider);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function complete(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  return forEachConfiguredProvider((provider) =>
    provider === "anthropic" ? completeAnthropic(params) : completeWithOpenAI(params),
  );
}

async function completeJSON<T>(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
}): Promise<T> {
  return forEachConfiguredProvider((provider) =>
    provider === "anthropic"
      ? completeJSONAnthropic<T>(params)
      : completeJSONWithOpenAI<T>(params),
  );
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

export async function generateMatterDigest(context: string): Promise<string> {
  const system = `You are a legal assistant producing an executive matter digest for a lawyer. Base every statement only on the provided matter documents — never invent facts, parties, or dates. Cite the source filename in parentheses after any fact you draw from a document — if the source text has page markers (e.g. "[Page 4]"), include the page too, like "(file.pdf, p. 4)". Structure your answer in these sections, using "Not stated in the provided documents" for anything you cannot support:

## Executive summary
## Parties
## Key dates
## Facts (agreed, disputed, unknown)
## Evidence inventory
## Missing documents / open questions`;

  if (!context) {
    return "No documents have been uploaded for this matter yet — upload documents first, then generate a digest.";
  }

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

export async function extractDeadlines(context: string): Promise<ExtractedDeadline[]> {
  if (!context) return [];

  const system = `You extract deadlines and important dates from legal matter documents. Only include dates that represent a genuine deadline, court date, limitation period, or similarly actionable date — not every date mentioned. If a date is mentioned but not clearly formatted, set dueDate to null and describe it in the description. If there are no such dates, return an empty list.`;

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

export async function generateDraft(
  draftType: DraftType,
  context: string,
  instructions: string,
): Promise<string> {
  const system =
    draftType === "Defence strategy memo"
      ? DEFENCE_STRATEGY_SYSTEM
      : `You are a legal assistant drafting a ${draftType.toLowerCase()} for a lawyer's review. Base every fact on the provided matter documents — cite the source filename in parentheses after any fact you draw from a document — if the source text has page markers (e.g. "[Page 4]"), include the page too, like "(file.pdf, p. 4)". Clearly distinguish verified fact from inference. This is a first draft only, explicitly for lawyer review before use — do not present it as final or ready to send. If the documents don't contain enough information for part of the draft, write "[NEEDS LAWYER INPUT: ...]" rather than inventing content.`;

  const contextSection = context
    ? `Matter documents:\n\n${context}\n\n`
    : "No documents have been uploaded for this matter yet.\n\n";

  return complete({
    system,
    messages: [
      {
        role: "user",
        content: `${contextSection}Draft a ${draftType.toLowerCase()}. ${instructions || ""}`.trim(),
      },
    ],
    maxTokens: 4096,
  });
}

export interface EmailDraft {
  subject: string;
  body: string;
}

export async function generateEmailDraft(context: string, instructions: string): Promise<EmailDraft> {
  const system = `You are a legal assistant drafting an email to a client on a lawyer's behalf, for the lawyer's review before sending — never send anything yourself, this is a first draft only. Base every fact on the provided matter documents — cite the source filename in parentheses after any fact you draw from a document. Keep the tone professional and appropriately concise for a client email, not a formal memo. Respond in exactly this format, with nothing before or after it:
Subject: <subject line>

<email body>`;

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

export async function generateEvidenceMatrix(context: string): Promise<string> {
  const system = `You are a legal assistant building an evidence-mapping matrix for a lawyer. Base every statement only on the provided matter documents — never invent allegations, evidence, or elements. Cite the source filename in parentheses after any fact you draw from a document — if the source text has page markers (e.g. "[Page 4]"), include the page too, like "(file.pdf, p. 4)". Structure your answer as:

## Allegations / claims / charges
## Elements to be proven (for each allegation/charge)
## Supporting evidence (mapped to each element, with source citations)
## Evidentiary gaps (elements with no supporting evidence in the provided documents)
## Possible defences or counterarguments suggested by the documents

Use "Not stated in the provided documents" for anything you cannot support. Do not predict an outcome or assign a probability of success — only map what is and isn't supported by the record.`;

  if (!context) {
    return "No documents have been uploaded for this matter yet — upload documents first, then generate the matrix.";
  }

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
