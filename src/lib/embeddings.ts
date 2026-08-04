import OpenAI from "openai";
import { getOpenaiApiKey } from "./settings";

export const EMBEDDING_MODEL = "text-embedding-3-small";

let cachedKey: string | null = null;
let cachedClient: OpenAI | null = null;

async function getClient(): Promise<OpenAI> {
  const apiKey = await getOpenaiApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key not configured in Settings — required for document search.");
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new OpenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

// OpenAI enforces a combined 300k-token limit per embeddings request across
// all inputs; chunks are a few hundred tokens each, so batching is a safe
// margin under that without needing an exact token count.
const EMBED_BATCH_SIZE = 200;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = await getClient();
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const response = await client.embeddings.create({ input: batch, model: EMBEDDING_MODEL });
    vectors.push(...response.data.map((d) => d.embedding));
  }
  return vectors;
}

export async function embedText(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text]);
  return vector;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
