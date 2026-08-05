import { NextResponse } from "next/server";
import { getDefaultTranslationLanguage, setDefaultTranslationLanguage } from "@/lib/settings";

export async function GET() {
  const language = await getDefaultTranslationLanguage();
  return NextResponse.json({ language });
}

export async function POST(request: Request) {
  const body = await request.json();
  const language = body?.language;
  if (typeof language !== "string" || !language.trim()) {
    return NextResponse.json({ error: "language is required" }, { status: 400 });
  }
  await setDefaultTranslationLanguage(language);
  return NextResponse.json({ language: language.trim() });
}
