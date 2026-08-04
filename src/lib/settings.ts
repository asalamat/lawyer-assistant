import { randomBytes } from "crypto";
import { decryptText, encryptText, isEncryptedText } from "./crypto";
import { readSecureJson, writeSecureJson } from "./secureStore";

const SETTINGS_FILE = "settings.json";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

export interface WeatherLocation {
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
}

export type AiProvider = "anthropic" | "openai";
const DEFAULT_AI_PROVIDER_ORDER: AiProvider[] = ["anthropic", "openai"];

interface Settings {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  canliiApiKey?: string;
  smtp?: SmtpConfig;
  location?: WeatherLocation;
  aiProviderOrder?: AiProvider[];
  cronSecret?: string;
}

const SECRET_FIELDS = ["anthropicApiKey", "openaiApiKey", "geminiApiKey", "canliiApiKey", "cronSecret"] as const;

// Settings secrets are encrypted at rest. Values written before this feature
// shipped are still plaintext on disk — migrate them to encrypted form the
// first time they're read, so nothing needs a separate migration script.
async function readSettings(): Promise<Settings> {
  const settings = await readSecureJson<Settings>(SETTINGS_FILE, {});
  let migrated = false;
  for (const field of SECRET_FIELDS) {
    const value = settings[field];
    if (typeof value === "string" && !isEncryptedText(value)) {
      settings[field] = await encryptText(value);
      migrated = true;
    }
  }
  if (settings.smtp?.password && !isEncryptedText(settings.smtp.password)) {
    settings.smtp.password = await encryptText(settings.smtp.password);
    migrated = true;
  }
  if (migrated) await writeSecureJson(SETTINGS_FILE, settings);
  return settings;
}

async function writeSettings(settings: Settings): Promise<void> {
  await writeSecureJson(SETTINGS_FILE, settings);
}

async function decryptSecret(value: string | undefined): Promise<string | undefined> {
  return value ? decryptText(value) : undefined;
}

export async function getAnthropicApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
}

export async function setAnthropicApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.anthropicApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getAnthropicApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.anthropicApiKey)) || process.env.ANTHROPIC_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.anthropicApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getGeminiApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.geminiApiKey)) || process.env.GEMINI_API_KEY;
}

export async function setGeminiApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.geminiApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getGeminiApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.geminiApiKey)) || process.env.GEMINI_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.geminiApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getSmtpConfig(): Promise<SmtpConfig | undefined> {
  const settings = await readSettings();
  if (!settings.smtp) return undefined;
  return { ...settings.smtp, password: await decryptText(settings.smtp.password) };
}

export async function setSmtpConfig(config: SmtpConfig): Promise<void> {
  const settings = await readSettings();
  settings.smtp = { ...config, password: await encryptText(config.password) };
  await writeSettings(settings);
}

// Returns the config with the password redacted, for display in the UI.
export async function getSmtpStatus(): Promise<{
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  username: string | null;
  fromName: string | null;
  fromEmail: string | null;
}> {
  const settings = await readSettings();
  const smtp = settings.smtp;
  if (!smtp) {
    return {
      configured: false,
      host: null,
      port: null,
      secure: true,
      username: null,
      fromName: null,
      fromEmail: null,
    };
  }
  return {
    configured: true,
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    username: smtp.username,
    fromName: smtp.fromName,
    fromEmail: smtp.fromEmail,
  };
}

export async function getCanliiApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.canliiApiKey)) || process.env.CANLII_API_KEY;
}

export async function setCanliiApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.canliiApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getCanliiApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.canliiApiKey)) || process.env.CANLII_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.canliiApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getWeatherLocation(): Promise<WeatherLocation | undefined> {
  const settings = await readSettings();
  return settings.location;
}

export async function setWeatherLocation(location: WeatherLocation): Promise<void> {
  const settings = await readSettings();
  settings.location = location;
  await writeSettings(settings);
}

export async function getAiProviderOrder(): Promise<AiProvider[]> {
  const settings = await readSettings();
  return settings.aiProviderOrder && settings.aiProviderOrder.length > 0
    ? settings.aiProviderOrder
    : DEFAULT_AI_PROVIDER_ORDER;
}

export async function setAiProviderOrder(order: AiProvider[]): Promise<void> {
  const settings = await readSettings();
  settings.aiProviderOrder = order;
  await writeSettings(settings);
}

export async function getOpenaiApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return (await decryptSecret(settings.openaiApiKey)) || process.env.OPENAI_API_KEY;
}

export async function setOpenaiApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.openaiApiKey = await encryptText(key);
  await writeSettings(settings);
}

export async function getOpenaiApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = (await decryptSecret(settings.openaiApiKey)) || process.env.OPENAI_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.openaiApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

// A separate secret for unattended endpoints (e.g. an OS cron job checking
// legislation watches) that can't go through the normal browser session
// login. Auto-generated on first access so there's always a value to check
// against, distinct from the user's login password.
export async function getOrCreateCronSecret(): Promise<string> {
  const settings = await readSettings();
  if (settings.cronSecret) return (await decryptSecret(settings.cronSecret)) as string;
  const secret = randomBytes(32).toString("hex");
  settings.cronSecret = await encryptText(secret);
  await writeSettings(settings);
  return secret;
}
