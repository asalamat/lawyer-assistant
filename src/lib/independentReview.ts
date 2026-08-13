import OpenAI from "openai";
import { completeAnthropic } from "./claude";
import { completeGemini } from "./gemini";
import { completeWithOpenAI } from "./openaiText";
import { completeOllama } from "./ollama";
import {
  getAnthropicApiKey,
  getDeepseekApiKey,
  getGeminiApiKey,
  getIndependentReviewProviderOrder,
  getMoonshotApiKey,
  getOllamaConfig,
  getOpenaiApiKey,
  type IndependentReviewProvider,
} from "./settings";

// A fallback SEQUENCE across whichever providers are configured, same
// failover shape as claude.ts's forEachConfiguredProvider for the primary
// chain — just a separate order and a wider provider universe (DeepSeek and
// Moonshot are review-only, see settings.ts's IndependentReviewProvider
// comment for why). DeepSeek and Moonshot expose OpenAI-SDK-compatible
// chat.completions APIs — same shape as the real OpenAI API, just a
// different base URL and key — so this reuses the already-installed
// `openai` package instead of adding a dependency per provider.

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-v4-pro"; // 1M-token context, reasoning-capable flagship

const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1"; // international endpoint — api.moonshot.cn is China-only, separate keys
const MOONSHOT_MODEL = "kimi-k3"; // 1M-token context flagship

// Same cap as openaiText.ts's MAX_CONTEXT_CHARS — a real matter's full
// document set can run past what's safe to send in one request even with a
// 1M-token model, once you account for the system prompt and the analysis
// being critiqued.
const MAX_CONTEXT_CHARS = 1_200_000;

const REVIEW_SYSTEM_INSTRUCTION = `You are an independent reviewer checking another AI's legal analysis of case documents for accuracy, completeness, and blind spots. You are NOT regenerating the analysis — you are critiquing it. Be specific about any disagreements, missed issues, or unsupported claims. Ground your critique in the source documents provided; if the analysis makes a claim the documents do not support, say so and name the document. Do not invent facts.`;

function buildUserMessage(content: string, context: string): string {
  const truncated = context.length > MAX_CONTEXT_CHARS;
  const boundedContext = truncated ? context.slice(0, MAX_CONTEXT_CHARS) : context;
  const sourceSection = context
    ? `Here are the matter's source documents${truncated ? " (truncated — this matter has more source material than fits in one review)" : ""}:\n\n${boundedContext}`
    : "No source documents were provided for this matter.";
  return `${sourceSection}\n\nHere is the other AI's analysis to review:\n\n${content}\n\nProvide your independent critique.`;
}

async function completeWithOpenAiCompatible(
  params: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number },
  config: { apiKey: string; baseURL: string; model: string; providerName: string },
): Promise<string> {
  const client = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [{ role: "system", content: params.system }, ...params.messages],
    max_tokens: params.maxTokens ?? 4096,
  });
  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error(`${config.providerName} returned an empty response.`);
  }
  return text;
}

async function completeWithDeepSeek(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const apiKey = await getDeepseekApiKey();
  if (!apiKey) throw new Error("No DeepSeek API key configured. Add one in Settings > AI model.");
  return completeWithOpenAiCompatible(params, {
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
    model: DEEPSEEK_MODEL,
    providerName: "DeepSeek",
  });
}

async function completeWithMoonshot(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const apiKey = await getMoonshotApiKey();
  if (!apiKey) throw new Error("No Moonshot AI API key configured. Add one in Settings > AI model.");
  return completeWithOpenAiCompatible(params, {
    apiKey,
    baseURL: MOONSHOT_BASE_URL,
    model: MOONSHOT_MODEL,
    providerName: "Moonshot AI",
  });
}

async function isIndependentReviewProviderConfigured(provider: IndependentReviewProvider): Promise<boolean> {
  if (provider === "anthropic") return Boolean(await getAnthropicApiKey());
  if (provider === "openai") return Boolean(await getOpenaiApiKey());
  if (provider === "gemini") return Boolean(await getGeminiApiKey());
  if (provider === "ollama") return Boolean(await getOllamaConfig());
  if (provider === "deepseek") return Boolean(await getDeepseekApiKey());
  return Boolean(await getMoonshotApiKey());
}

async function completeWithProvider(
  provider: IndependentReviewProvider,
  params: { system: string; messages: { role: "user" | "assistant"; content: string }[]; maxTokens?: number },
): Promise<string> {
  if (provider === "anthropic") return completeAnthropic(params);
  if (provider === "openai") return completeWithOpenAI(params);
  if (provider === "gemini") return completeGemini(params);
  if (provider === "ollama") return completeOllama(params);
  if (provider === "deepseek") return completeWithDeepSeek(params);
  return completeWithMoonshot(params);
}

export async function getIndependentReview(content: string, context: string): Promise<string> {
  const order = await getIndependentReviewProviderOrder();
  const params = {
    system: REVIEW_SYSTEM_INSTRUCTION,
    messages: [{ role: "user" as const, content: buildUserMessage(content, context) }],
    maxTokens: 4096,
  };

  const configured: IndependentReviewProvider[] = [];
  for (const provider of order) {
    if (await isIndependentReviewProviderConfigured(provider)) configured.push(provider);
  }
  // Same rule as claude.ts's forEachConfiguredProvider: if nothing in the
  // chosen order is configured, still attempt the first one so its natural
  // "no key configured" error surfaces, rather than a generic failure.
  const attemptOrder = configured.length > 0 ? configured : order;

  const failures: { provider: IndependentReviewProvider; error: unknown }[] = [];
  for (const provider of attemptOrder) {
    try {
      return await completeWithProvider(provider, params);
    } catch (err) {
      failures.push({ provider, error: err });
    }
  }

  if (failures.length === 1) throw failures[0].error;
  const combined = failures
    .map(({ provider, error }) => `${provider}: ${error instanceof Error ? error.message : String(error)}`)
    .join(" | ");
  throw new Error(`All configured independent-review providers failed. ${combined}`);
}
