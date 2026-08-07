import { NextResponse } from "next/server";
import { aiErrorResponse } from "@/lib/aiErrorResponse";
import { translateText } from "@/lib/claude";

// Generic — not tied to a matter, so any authenticated user can translate
// any AI-generated output they can already see. No audit event: this
// doesn't create or change any matter data, just a client-facing rendering
// of something already generated.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text : "";
  const targetLanguage = typeof body?.targetLanguage === "string" ? body.targetLanguage : "";

  if (!text.trim() || !targetLanguage.trim()) {
    return NextResponse.json({ error: "text and targetLanguage are required" }, { status: 400 });
  }

  try {
    const translated = await translateText(text, targetLanguage);
    return NextResponse.json({ translated });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
