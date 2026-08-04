import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { askClaude } from "@/lib/claude";
import {
  addChatMessage,
  getMatter,
  getMatterChatContext,
  listChatMessages,
} from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const messages = await listChatMessages(id);
  return NextResponse.json(messages);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = await request.json();
  const question = body?.question;
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const priorMessages = await listChatMessages(id);
  await addChatMessage(id, "user", question);

  const context = await getMatterChatContext(id, question);
  try {
    const answer = await askClaude({
      question,
      context,
      history: priorMessages.map((m) => ({ role: m.role, content: m.content })),
    });
    const assistantMessage = await addChatMessage(id, "assistant", answer);
    return NextResponse.json(assistantMessage, { status: 201 });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `AI service error: ${err.message}` },
        { status: err.status ?? 502 },
      );
    }
    if (err instanceof Error && err.message.includes("No Anthropic API key")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
