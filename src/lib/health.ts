import {
  getAnthropicApiKeyStatus,
  getCanliiApiKeyStatus,
  getDeepseekApiKeyStatus,
  getGeminiApiKeyStatus,
  getIndependentReviewProviderOrder,
  getMoonshotApiKeyStatus,
  getOllamaConfig,
  getOpenaiApiKeyStatus,
  getSmtpStatus,
  getWeatherLocation,
  type IndependentReviewProvider,
} from "./settings";

const INDEPENDENT_REVIEW_LABELS: Record<IndependentReviewProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  ollama: "Ollama",
  deepseek: "DeepSeek",
  moonshot: "Moonshot AI",
};

export interface HealthCheck {
  name: string;
  configured: boolean;
  detail: string;
  settingsHref: string;
}

export interface HealthStatus {
  overall: "ok" | "down";
  checks: HealthCheck[];
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const [anthropic, openai, gemini, deepseek, moonshot, ollama, canlii, smtp, location, independentReviewOrder] =
    await Promise.all([
      getAnthropicApiKeyStatus(),
      getOpenaiApiKeyStatus(),
      getGeminiApiKeyStatus(),
      getDeepseekApiKeyStatus(),
      getMoonshotApiKeyStatus(),
      getOllamaConfig(),
      getCanliiApiKeyStatus(),
      getSmtpStatus(),
      getWeatherLocation(),
      getIndependentReviewProviderOrder(),
    ]);

  const anyAiConfigured = anthropic.configured || openai.configured;

  const providerConfigured: Record<IndependentReviewProvider, boolean> = {
    anthropic: anthropic.configured,
    openai: openai.configured,
    gemini: gemini.configured,
    ollama: Boolean(ollama),
    deepseek: deepseek.configured,
    moonshot: moonshot.configured,
  };
  const independentReviewProvider =
    independentReviewOrder.find((provider) => providerConfigured[provider]) ?? independentReviewOrder[0];

  const checks: HealthCheck[] = [
    {
      name: "Primary AI (Anthropic)",
      configured: anthropic.configured,
      detail: anthropic.configured ? "Configured" : "Not configured — required for chat, digests, and drafting",
      settingsHref: "/settings/ai",
    },
    {
      name: "Backup AI (OpenAI)",
      configured: openai.configured,
      detail: openai.configured ? "Configured" : "Not configured — no automatic failover if the primary provider fails",
      settingsHref: "/settings/ai",
    },
    {
      name: `Independent review (${INDEPENDENT_REVIEW_LABELS[independentReviewProvider]})`,
      configured: providerConfigured[independentReviewProvider],
      detail: providerConfigured[independentReviewProvider] ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/ai",
    },
    {
      name: "Transcription (OpenAI Whisper)",
      configured: openai.configured,
      detail: openai.configured ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/transcription",
    },
    {
      name: "Legal research (CanLII)",
      configured: canlii.configured,
      detail: canlii.configured ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/legal-research",
    },
    {
      name: "Email (SMTP)",
      configured: smtp.configured,
      detail: smtp.configured ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/email",
    },
    {
      name: "Weather location",
      configured: Boolean(location),
      detail: location ? `Set to ${location.name}` : "Not set — optional",
      settingsHref: "/settings",
    },
  ];

  return {
    overall: anyAiConfigured ? "ok" : "down",
    checks,
  };
}
