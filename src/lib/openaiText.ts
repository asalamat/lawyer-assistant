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
  return response.output_text ?? "";
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
  return JSON.parse(response.output_text) as T;
}
