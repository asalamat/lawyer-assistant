import { readSecureJson, writeSecureJson } from "./secureStore";

const SETTINGS_FILE = "settings.json";

interface Settings {
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  canliiApiKey?: string;
}

async function readSettings(): Promise<Settings> {
  return readSecureJson<Settings>(SETTINGS_FILE, {});
}

async function writeSettings(settings: Settings): Promise<void> {
  await writeSecureJson(SETTINGS_FILE, settings);
}

export async function getAnthropicApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
}

export async function setAnthropicApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.anthropicApiKey = key;
  await writeSettings(settings);
}

export async function getAnthropicApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.anthropicApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getGeminiApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return settings.geminiApiKey || process.env.GEMINI_API_KEY;
}

export async function setGeminiApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.geminiApiKey = key;
  await writeSettings(settings);
}

export async function getGeminiApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = settings.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.geminiApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getCanliiApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return settings.canliiApiKey || process.env.CANLII_API_KEY;
}

export async function setCanliiApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.canliiApiKey = key;
  await writeSettings(settings);
}

export async function getCanliiApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = settings.canliiApiKey || process.env.CANLII_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.canliiApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}

export async function getOpenaiApiKey(): Promise<string | undefined> {
  const settings = await readSettings();
  return settings.openaiApiKey || process.env.OPENAI_API_KEY;
}

export async function setOpenaiApiKey(key: string): Promise<void> {
  const settings = await readSettings();
  settings.openaiApiKey = key;
  await writeSettings(settings);
}

export async function getOpenaiApiKeyStatus(): Promise<{
  configured: boolean;
  source: "settings" | "env" | "none";
  preview: string | null;
}> {
  const settings = await readSettings();
  const key = settings.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!key) return { configured: false, source: "none", preview: null };
  return {
    configured: true,
    source: settings.openaiApiKey ? "settings" : "env",
    preview: `••••${key.slice(-4)}`,
  };
}
