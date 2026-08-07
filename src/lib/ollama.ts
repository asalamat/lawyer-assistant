import { DEFAULT_OLLAMA_BASE_URL, getOllamaConfig } from "./settings";

// No SDK — Ollama's local REST API is simple enough that a dependency
// would add more surface area than it saves. Everything here talks to
// whatever OLLAMA_BASE_URL points at, which defaults to localhost and
// never leaves the machine unless the account owner deliberately points
// it somewhere else.

interface OllamaChatResponse {
  message?: { content?: string };
}

async function chat(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  format?: Record<string, unknown> | "json";
  maxTokens?: number;
}): Promise<string> {
  const config = await getOllamaConfig();
  if (!config) {
    throw new Error(
      "No Ollama model configured. Pull one locally first (e.g. `ollama pull llama3.1`), then add its name in Settings > AI model.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "system", content: params.system }, ...params.messages],
        stream: false,
        format: params.format,
        options: { num_predict: params.maxTokens ?? 1024 },
      }),
    });
  } catch (err) {
    throw new Error(
      `Could not reach Ollama at ${config.baseUrl} — is it running? (${err instanceof Error ? err.message : "connection failed"})`,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Ollama error (${response.status}): ${text || response.statusText}`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  if (!data.message?.content) {
    throw new Error("Ollama returned an empty response.");
  }
  return data.message.content;
}

// No `tier` param, unlike the other providers (see modelTiers.ts) — there's
// exactly one configured local model, and no cost signal to route around.
export async function completeOllama(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  return chat(params);
}

export async function completeJSONOllama<T>(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const raw = await chat({ ...params, format: params.schema });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      "Ollama's response wasn't valid JSON — try regenerating, or a different local model may follow structured-output instructions better.",
    );
  }
}

// Accepts an explicit baseUrl (e.g. whatever's currently typed in the
// settings form, not yet saved) so the account owner can test before
// committing to a value — falls back to the saved/default one if omitted.
export async function testOllamaConnection(
  baseUrlOverride?: string,
): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  const settings = await getOllamaConfig();
  const baseUrl = baseUrlOverride?.trim() || settings?.baseUrl || DEFAULT_OLLAMA_BASE_URL;
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const data = (await response.json()) as { models?: { name: string }[] };
    return { ok: true, models: (data.models ?? []).map((m) => m.name) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
  }
}
