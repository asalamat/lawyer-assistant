import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "./settings";
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

async function complete(params: {
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
  return textBlock?.text ?? "";
}

// Uses Claude's structured-output mode (output_config.format) instead of
// asking for JSON in prose and hoping the model complies — a prompt-only
// "respond with ONLY a JSON array" instruction is not reliably followed
// and produced parse failures in practice (markdown fences, stray prose).
// Structured outputs constrain the response to the given schema server-side.
async function completeJSON<T>(params: {
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
  return JSON.parse(textBlock.text) as T;
}

export async function askClaude(params: {
  question: string;
  context: string;
  history: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const { question, context, history } = params;

  const system = context
    ? `You are a legal assistant answering questions about a specific matter. Base your answer only on the following matter documents. Cite the source filename in parentheses after any fact you draw from a document. If the documents don't contain enough information to answer, say so explicitly rather than guessing.\n\n${context}`
    : "You are a legal assistant. No documents have been uploaded for this matter yet, so say you have no source material to cite and answer only in general terms.";

  return complete({
    system,
    messages: [...history, { role: "user", content: question }],
  });
}

export async function generateMatterDigest(context: string): Promise<string> {
  const system = `You are a legal assistant producing an executive matter digest for a lawyer. Base every statement only on the provided matter documents — never invent facts, parties, or dates. Cite the source filename in parentheses after any fact you draw from a document. Structure your answer in these sections, using "Not stated in the provided documents" for anything you cannot support:

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
    maxTokens: 2048,
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
    maxTokens: 1024,
  });

  return result.deadlines ?? [];
}

export async function generateDraft(
  draftType: DraftType,
  context: string,
  instructions: string,
): Promise<string> {
  const system = `You are a legal assistant drafting a ${draftType.toLowerCase()} for a lawyer's review. Base every fact on the provided matter documents — cite the source filename in parentheses after any fact you draw from a document. Clearly distinguish verified fact from inference. This is a first draft only, explicitly for lawyer review before use — do not present it as final or ready to send. If the documents don't contain enough information for part of the draft, write "[NEEDS LAWYER INPUT: ...]" rather than inventing content.`;

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
    maxTokens: 2048,
  });
}

export async function generateEvidenceMatrix(context: string): Promise<string> {
  const system = `You are a legal assistant building an evidence-mapping matrix for a lawyer. Base every statement only on the provided matter documents — never invent allegations, evidence, or elements. Cite the source filename in parentheses after any fact you draw from a document. Structure your answer as:

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
    maxTokens: 2048,
  });
}
