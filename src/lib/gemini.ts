import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "./settings";

let cachedKey: string | null = null;
let cachedClient: GoogleGenAI | null = null;

async function getClient(): Promise<GoogleGenAI> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured in Settings.");
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

export async function getIndependentReview(content: string, context: string): Promise<string> {
  const client = await getClient();

  const systemInstruction = `You are an independent reviewer checking another AI's legal analysis of case documents for accuracy, completeness, and blind spots. You are NOT regenerating the analysis — you are critiquing it. Be specific about any disagreements, missed issues, or unsupported claims. Ground your critique in the source documents provided; if the analysis makes a claim the documents do not support, say so and name the document. Do not invent facts.`;

  const sourceSection = context
    ? `Here are the matter's source documents:\n\n${context}`
    : "No source documents were provided for this matter.";

  const response = await client.models.generateContent({
    model: "gemini-3.5-flash",
    contents: `${sourceSection}\n\nHere is the other AI's analysis to review:\n\n${content}\n\nProvide your independent critique.`,
    config: {
      systemInstruction,
    },
  });

  return response.text ?? "";
}
