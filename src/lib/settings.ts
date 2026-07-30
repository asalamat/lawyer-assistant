import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

interface Settings {
  anthropicApiKey?: string;
}

async function readSettings(): Promise<Settings> {
  if (!existsSync(SETTINGS_PATH)) return {};
  const raw = await readFile(SETTINGS_PATH, "utf-8");
  return JSON.parse(raw) as Settings;
}

async function writeSettings(settings: Settings): Promise<void> {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
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
