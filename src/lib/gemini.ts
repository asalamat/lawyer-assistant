import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "./settings";

let cachedKey: string | null = null;
let cachedClient: GoogleGenAI | null = null;

async function getClient(): Promise<GoogleGenAI> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured in Settings.");
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

// Gemini has no separate "system" message slot in the same shape as
// Anthropic/OpenAI's chat-style params — folded into systemInstruction, with
// prior turns flattened into the prompt text, matching how completeAnthropic/
// completeWithOpenAI's `messages` are used elsewhere (mostly single-turn).
function flattenMessages(messages: { role: "user" | "assistant"; content: string }[]): string {
  return messages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
}

export async function completeGemini(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const client = await getClient();
  const response = await client.models.generateContent({
    model: "gemini-3.5-flash",
    contents: flattenMessages(params.messages),
    config: {
      systemInstruction: params.system,
      maxOutputTokens: params.maxTokens ?? 1024,
    },
  });
  if (!response.text) {
    // Same reasoning as completeAnthropic/completeWithOpenAI: a "successful"
    // response with no text must throw, not return "", or the caller in
    // claude.ts's forEachConfiguredProvider treats it as a completed success
    // and never tries the next provider.
    throw new Error("Gemini returned an empty response.");
  }
  return response.text;
}

export async function completeJSONGemini<T>(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const client = await getClient();
  const response = await client.models.generateContent({
    model: "gemini-3.5-flash",
    contents: flattenMessages(params.messages),
    config: {
      systemInstruction: params.system,
      maxOutputTokens: params.maxTokens ?? 1024,
      responseMimeType: "application/json",
      responseSchema: params.schema,
    },
  });
  if (!response.text) {
    throw new Error("Gemini returned an empty response.");
  }
  try {
    return JSON.parse(response.text) as T;
  } catch {
    // See the matching catch in claude.ts's completeJSONAnthropic — a raw
    // JSON.parse SyntaxError means the response was cut off mid-structure,
    // almost always because maxTokens was too small for this input.
    throw new Error(
      "The AI's response was cut off before finishing — try regenerating. If it keeps happening, this matter may have too much content for one pass.",
    );
  }
}
