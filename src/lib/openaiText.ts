import OpenAI from "openai";
import { getOpenaiApiKey } from "./settings";

let cachedKey: string | null = null;
let cachedClient: OpenAI | null = null;

async function getClient(): Promise<OpenAI> {
  const apiKey = await getOpenaiApiKey();
  if (!apiKey) {
    throw new Error("No OpenAI API key configured. Add one in Settings.");
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new OpenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

export async function completeWithOpenAI(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const client = await getClient();
  const response = await client.responses.create({
    model: "gpt-5.6",
    input: [{ role: "system", content: params.system }, ...params.messages],
    max_output_tokens: params.maxTokens ?? 1024,
  });
  if (!response.output_text) {
    // Same reasoning as completeJSONWithOpenAI below: a 200 response with
    // no visible output text (e.g. reasoning tokens consuming the whole
    // budget on a large input) must throw, not return "", or the caller
    // in claude.ts's forEachConfiguredProvider treats it as a completed
    // success and silently persists an empty result.
    throw new Error("OpenAI returned an empty response.");
  }
  return response.output_text;
}

// OpenAI enforces an org-wide tokens-per-minute cap (500k on this account) on
// top of any per-model context window — a single oversized request 429s no
// matter how idle the account is, so unlike a normal rate limit this can't be
// fixed by retrying. Observed in production: a matter with enough documents
// pushed one request to 509,730 tokens. ~4 chars/token is a safe estimate for
// English legal text, so this cap leaves generous headroom for the system
// prompt, the content being reviewed, and the output-token reservation.
const MAX_CONTEXT_CHARS = 1_200_000;

export async function getIndependentReview(content: string, context: string): Promise<string> {
  const systemInstruction = `You are an independent reviewer checking another AI's legal analysis of case documents for accuracy, completeness, and blind spots. You are NOT regenerating the analysis — you are critiquing it. Be specific about any disagreements, missed issues, or unsupported claims. Ground your critique in the source documents provided; if the analysis makes a claim the documents do not support, say so and name the document. Do not invent facts.`;

  const truncated = context.length > MAX_CONTEXT_CHARS;
  const boundedContext = truncated ? context.slice(0, MAX_CONTEXT_CHARS) : context;
  const sourceSection = context
    ? `Here are the matter's source documents${truncated ? " (truncated — this matter has more source material than fits in one review)" : ""}:\n\n${boundedContext}`
    : "No source documents were provided for this matter.";

  return completeWithOpenAI({
    system: systemInstruction,
    messages: [
      {
        role: "user",
        content: `${sourceSection}\n\nHere is the other AI's analysis to review:\n\n${content}\n\nProvide your independent critique.`,
      },
    ],
  });
}

export async function completeJSONWithOpenAI<T>(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
}): Promise<T> {
  const client = await getClient();
  const response = await client.responses.create({
    model: "gpt-5.6",
    input: [{ role: "system", content: params.system }, ...params.messages],
    max_output_tokens: params.maxTokens ?? 1024,
    text: {
      format: {
        type: "json_schema",
        name: params.schemaName,
        schema: params.schema,
        strict: true,
      },
    },
  });
  if (!response.output_text) {
    throw new Error("OpenAI returned an empty response.");
  }
  try {
    return JSON.parse(response.output_text) as T;
  } catch {
    // See the matching catch in claude.ts's completeJSONAnthropic — a raw
    // JSON.parse SyntaxError means the response was cut off mid-structure,
    // almost always because maxTokens was too small for this input.
    throw new Error(
      "The AI's response was cut off before finishing — try regenerating. If it keeps happening, this matter may have too much content for one pass.",
    );
  }
}
