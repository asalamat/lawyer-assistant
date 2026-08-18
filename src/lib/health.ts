import { isMalwareScanningAvailable } from "./malwareScan";
import {
  getAnthropicApiKeyStatus,
  getCanliiApiKeyStatus,
  getCloudBackupStatus,
  getDeepseekApiKeyStatus,
  getDocuSignStatus,
  getGeminiApiKeyStatus,
  getIndependentReviewProviderOrder,
  getMoonshotApiKeyStatus,
  getOllamaConfig,
  getOpenaiApiKeyStatus,
  getQuickBooksStatus,
  getSmtpStatus,
  getStripeStatus,
  getTwilioStatus,
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
  const [
    anthropic,
    openai,
    gemini,
    deepseek,
    moonshot,
    ollama,
    canlii,
    smtp,
    location,
    independentReviewOrder,
    twilio,
    stripe,
    quickbooks,
    docusign,
    cloudBackup,
    malwareScanAvailable,
  ] = await Promise.all([
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
    getTwilioStatus(),
    getStripeStatus(),
    getQuickBooksStatus(),
    getDocuSignStatus(),
    getCloudBackupStatus(),
    isMalwareScanningAvailable(),
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
      name: "Gemini AI",
      configured: gemini.configured,
      detail: gemini.configured ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/ai",
    },
    {
      name: "Local AI (Ollama)",
      configured: Boolean(ollama),
      detail: ollama ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/ai",
    },
    {
      name: "DeepSeek (review only)",
      configured: deepseek.configured,
      detail: deepseek.configured ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/ai",
    },
    {
      name: "Moonshot AI (review only)",
      configured: moonshot.configured,
      detail: moonshot.configured ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/ai",
    },
    {
      name: "SMS texting (Twilio)",
      configured: twilio.configured,
      detail: twilio.configured ? `Configured (${twilio.fromPhoneNumber})` : "Not configured — optional",
      settingsHref: "/settings/sms",
    },
    {
      name: "Online payments (Stripe)",
      configured: stripe.configured,
      detail: stripe.configured ? "Configured" : "Not configured — optional",
      settingsHref: "/settings/payments",
    },
    {
      name: "Accounting sync (QuickBooks)",
      configured: quickbooks.connected,
      detail: quickbooks.connected
        ? `Connected to ${quickbooks.companyName ?? "a company file"}`
        : quickbooks.appConfigured
          ? "App configured, not connected — optional"
          : "Not configured — optional",
      settingsHref: "/settings/quickbooks",
    },
    {
      name: "E-signature (DocuSign)",
      configured: docusign.configured,
      detail: docusign.configured
        ? docusign.enabled
          ? "Configured and enabled"
          : "Configured but turned off — optional"
        : "Not configured — optional (this app's own e-signature works with no setup)",
      settingsHref: "/settings/docusign",
    },
    {
      name: "Cloud backup",
      configured: cloudBackup.configured,
      detail: cloudBackup.configured
        ? `Configured (${cloudBackup.provider ?? "unknown provider"})`
        : "Not configured — optional, local backups still run",
      settingsHref: "/settings/backup",
    },
    {
      name: "Malware scanning (ClamAV)",
      configured: malwareScanAvailable,
      detail: malwareScanAvailable
        ? "Available — every upload is scanned"
        : "Not available — uploads are not scanned for malware",
      settingsHref: "/settings/privacy",
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
