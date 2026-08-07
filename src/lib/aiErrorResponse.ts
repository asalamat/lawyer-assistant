import { ApiError as GeminiApiError } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { NextResponse } from "next/server";

// Every AI-generation route calls into claude.ts's provider-fallback loop
// (forEachConfiguredProvider), which can surface ANY configured provider's
// own error type once all providers have been tried — not just Anthropic's.
// A route that only knew how to recognize Anthropic.APIError and rethrew
// everything else crashed with an uncaught exception whenever OpenAI or
// Gemini was the one that actually failed (e.g. a Gemini rate-limit 429):
// Next.js returns an empty 500 body for an uncaught route-handler exception,
// which breaks the client's res.json() with a confusing "Unexpected end of
// JSON input" instead of a real error message. Route every AI route's catch
// block through here instead of duplicating (and under-covering) the same
// per-provider checks.
export function aiErrorResponse(err: unknown): NextResponse {
  if (err instanceof Anthropic.APIError || err instanceof OpenAI.APIError || err instanceof GeminiApiError) {
    return NextResponse.json(
      { error: `AI service error: ${err.message}` },
      { status: err.status ?? 502 },
    );
  }
  if (err instanceof Error) {
    // "No Anthropic API key" / "OpenAI API key not configured" / "Gemini
    // API key not configured in Settings" etc. — a configuration problem,
    // not a service failure, so 400 rather than 500.
    const status = /api key/i.test(err.message) ? 400 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
  return NextResponse.json({ error: "Something went wrong generating this." }, { status: 500 });
}
