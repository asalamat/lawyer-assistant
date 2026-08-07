import { NextResponse } from "next/server";
import { testOllamaConnection } from "@/lib/ollama";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get("baseUrl") ?? undefined;
  const result = await testOllamaConnection(baseUrl);
  return NextResponse.json(result);
}
