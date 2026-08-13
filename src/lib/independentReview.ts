import OpenAI from "openai";
import { getIndependentReview as getOpenAiIndependentReview } from "./openaiText";
import { getDeepseekApiKey, getIndependentReviewProvider, getMoonshotApiKey } from "./settings";

// DeepSeek and Moonshot AI (Kimi) both expose OpenAI-SDK-compatible APIs —
// same request/response shape as the real OpenAI API, just a different
// base URL and key — so this reuses the already-installed `openai` package
// rather than adding a new dependency per provider. Both only confirmed to
// support the classic chat.completions shape (not the newer responses API
// openaiText.ts uses for real OpenAI), so this talks to them that way.

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

async function getReviewFromOpenAiCompatible(
  content: string,
  context: string,
  params: { apiKey: string; baseURL: string; model: string; providerName: string },
): Promise<string> {
  const client = new OpenAI({ apiKey: params.apiKey, baseURL: params.baseURL });
  const response = await client.chat.completions.create({
    model: params.model,
    messages: [
      { role: "system", content: REVIEW_SYSTEM_INSTRUCTION },
      { role: "user", content: buildUserMessage(content, context) },
    ],
    max_tokens: 4096,
  });
  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error(`${params.providerName} returned an empty response.`);
  }
  return text;
}

export async function getIndependentReview(content: string, context: string): Promise<string> {
  const provider = await getIndependentReviewProvider();

  if (provider === "deepseek") {
    const apiKey = await getDeepseekApiKey();
    if (!apiKey) throw new Error("No DeepSeek API key configured. Add one in Settings > AI model.");
    return getReviewFromOpenAiCompatible(content, context, {
      apiKey,
      baseURL: DEEPSEEK_BASE_URL,
      model: DEEPSEEK_MODEL,
      providerName: "DeepSeek",
    });
  }

  if (provider === "moonshot") {
    const apiKey = await getMoonshotApiKey();
    if (!apiKey) throw new Error("No Moonshot AI API key configured. Add one in Settings > AI model.");
    return getReviewFromOpenAiCompatible(content, context, {
      apiKey,
      baseURL: MOONSHOT_BASE_URL,
      model: MOONSHOT_MODEL,
      providerName: "Moonshot AI",
    });
  }

  return getOpenAiIndependentReview(content, context);
}
