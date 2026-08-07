import type { AiProvider } from "./settings";

// "fast" = a lower-cost/quicker model for simple, well-scoped tasks
// (classification, extraction, per-document summarization) — "capable" =
// the flagship model for tasks that need real legal reasoning (digests,
// evidence matrices, drafts, chat, final synthesis). This mirrors the
// classification/extraction-vs-complex-reasoning split the original
// architecture doc's model-routing table recommends, as a way to manage
// token spend without touching quality where it actually matters.
//
// Every fast-tier id below was checked against that provider's own
// currently-installed SDK type definitions (node_modules/.../*.d.ts) before
// being hardcoded here, rather than guessed from a plausible-sounding name
// — model names change fast enough that guessing risks silently routing
// "cost savings" requests at a model that doesn't exist.
export type ModelTier = "fast" | "capable";

export const MODEL_IDS: Record<AiProvider, Record<ModelTier, string>> = {
  anthropic: { capable: "claude-sonnet-5", fast: "claude-haiku-4-5" },
  openai: { capable: "gpt-5.6", fast: "gpt-5.4-mini" },
  // "-latest" alias rather than a pinned version, so this doesn't need a
  // code change every time Google ships a new flash-lite generation.
  gemini: { capable: "gemini-3.5-flash", fast: "gemini-flash-lite-latest" },
  // Not tiered — the account owner configures exactly one local model, and
  // there's no cost signal to optimize (it's free to run either way).
  ollama: { capable: "", fast: "" },
};
