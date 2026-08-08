import { getCalendarSyncAccount } from "./calendarSync";
import {
  getAnthropicApiKeyStatus,
  getCanliiApiKeyStatus,
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
  const [anthropic, openai, canlii, smtp, location, calendarSyncAccount] = await Promise.all([
    getAnthropicApiKeyStatus(),
    getOpenaiApiKeyStatus(),
    getCanliiApiKeyStatus(),
    getSmtpStatus(),
    getWeatherLocation(),
    getCalendarSyncAccount(),
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
      name: "Independent review (OpenAI)",
      configured: openai.configured,
      detail: openai.configured ? "Configured" : "Not configured — optional",
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
    {
      name: "Calendar sync (deadlines)",
      configured: Boolean(calendarSyncAccount),
      detail: calendarSyncAccount
        ? `Enabled via ${calendarSyncAccount.provider} (${calendarSyncAccount.emailAddress})`
        : "Not enabled — optional; rule-computed deadlines won't push to a calendar automatically",
      settingsHref: "/settings/integrations",
    },
  ];

  return {
    overall: anyAiConfigured ? "ok" : "down",
    checks,
  };
}
