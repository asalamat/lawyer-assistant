import OpenAI from "openai";
import { MODEL_IDS, type ModelTier } from "./modelTiers";
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

export async function analyzeImageWithOpenAI(
  buffer: Buffer,
  mimeType: string,
  prompt: string,
): Promise<string> {
  const client = await getClient();
  const response = await client.responses.create({
    model: MODEL_IDS.openai.capable,
    input: [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: `data:${mimeType};base64,${buffer.toString("base64")}`, detail: "auto" },
          { type: "input_text", text: prompt },
        ],
      },
    ],
    max_output_tokens: 1024,
  });
  if (!response.output_text) {
    throw new Error("OpenAI returned an empty response.");
  }
  return response.output_text;
}

export async function completeWithOpenAI(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  tier?: ModelTier;
}): Promise<string> {
  const client = await getClient();
  const response = await client.responses.create({
    model: MODEL_IDS.openai[params.tier ?? "capable"],
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

export async function completeJSONWithOpenAI<T>(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens?: number;
  tier?: ModelTier;
}): Promise<T> {
  const client = await getClient();
  const response = await client.responses.create({
    model: MODEL_IDS.openai[params.tier ?? "capable"],
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
