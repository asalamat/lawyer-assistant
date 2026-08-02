import {
  getAnthropicApiKeyStatus,
  getCanliiApiKeyStatus,
  getGeminiApiKeyStatus,
  getOpenaiApiKeyStatus,
  getSmtpStatus,
  getWeatherLocation,
} from "./settings";

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
  const [anthropic, openai, gemini, canlii, smtp, location] = await Promise.all([
    getAnthropicApiKeyStatus(),
    getOpenaiApiKeyStatus(),
    getGeminiApiKeyStatus(),
    getCanliiApiKeyStatus(),
    getSmtpStatus(),
    getWeatherLocation(),
  ]);

  const anyAiConfigured = anthropic.configured || openai.configured;

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
      name: "Independent review (Gemini)",
      configured: gemini.configured,
      detail: gemini.configured ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/review",
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
