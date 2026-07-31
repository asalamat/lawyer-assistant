import OpenAI, { toFile } from "openai";
import { getOpenaiApiKey } from "./settings";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

let cachedKey: string | null = null;
let cachedClient: OpenAI | null = null;

async function getClient(): Promise<OpenAI> {
  const apiKey = await getOpenaiApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key not configured in Settings.");
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new OpenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

export async function transcribeAudio(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(
      `Audio file is too large to transcribe (${(buffer.length / (1024 * 1024)).toFixed(1)}MB). OpenAI's transcription limit is 25MB.`,
    );
  }

  const client = await getClient();
  const file = await toFile(buffer, fileName);
  const transcription = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });

  return transcription.text;
}
