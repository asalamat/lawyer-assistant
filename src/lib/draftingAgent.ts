import Anthropic from "@anthropic-ai/sdk";
import { buildDraftSystemPrompt, buildDraftUserPrompt } from "./claude";
import { verifyCitations } from "./citationCheck";
import { listDocuments } from "./matters";
import { buildContextFromChunks, ensureDocumentChunks, ensureReferenceDocumentChunks, getRelevantChunks } from "./rag";
import { listAttachedReferenceDocuments } from "./referenceLibrary";
import { getAnthropicApiKey } from "./settings";
import { isExtractableDocument } from "./textExtraction";
import type { AgentTraceStep, DraftType } from "./types";

// Anthropic tool use only — deliberately not routed through the
// multi-provider complete()/completeJSON() abstraction the rest of this
// app uses. Tool-calling request/response shapes differ enough between
// providers (Anthropic vs. OpenAI's Responses API) that replicating this
// loop for both, just so a self-checking draft can fail over the same way
// a one-shot generation does, isn't worth it for a first agent — if
// Anthropic isn't configured, this feature is unavailable and says so;
// the plain one-shot "Generate draft" (claude.ts's generateDraft, which
// does support both providers) is unaffected and still the default.
const MODEL = "claude-sonnet-5";

// Hard stop conditions — the actual safety property of an agent isn't "it
// usually finishes quickly," it's "it can never run unboundedly." Worst
// case: 1 initial pass + MAX_REVISION_ROUNDS revision passes, each up to
// MAX_TOOL_ITERATIONS model calls, so at most (1 + 2) * 4 = 12 Anthropic
// calls for one draft. No irreversible action is ever taken — the only
// tool available is a read-only document search — so the cost of hitting
// this cap is "the request takes a while and then errors," not anything
// unsafe.
const MAX_TOOL_ITERATIONS = 4;
const MAX_REVISION_ROUNDS = 2;
const CHUNKS_PER_SEARCH = 5;

const SEARCH_TOOL: Anthropic.Tool = {
  name: "search_matter_documents",
  description:
    "Search this matter's own uploaded documents (and any reference-library material attached to it) for passages relevant to a query. Use this whenever you're about to cite a specific fact, page, or filename and want to confirm it's actually there rather than relying on the context you were given at the start — especially before finishing your draft.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "What to search for, in plain language" },
    },
    required: ["query"],
  },
};

function isToolUseBlock(block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock {
  return block.type === "tool_use";
}

async function runToolLoop(
  client: Anthropic,
  system: string,
  messages: Anthropic.MessageParam[],
  matterId: string,
  trace: AgentTraceStep[],
): Promise<string> {
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages,
      tools: [SEARCH_TOOL],
    });
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(isToolUseBlock);
    if (toolUses.length === 0) {
      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
        throw new Error("The drafting agent returned an empty response. Try regenerating.");
      }
      return textBlock.text;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const query = String((toolUse.input as { query?: unknown }).query ?? "");
      trace.push({
        type: "tool_call",
        detail: `Searched matter documents for: "${query}"`,
        createdAt: new Date().toISOString(),
      });
      const chunks = query ? await getRelevantChunks(matterId, query, CHUNKS_PER_SEARCH) : [];
      trace.push({
        type: "tool_result",
        detail:
          chunks.length > 0
            ? `Found ${chunks.length} relevant passage(s)`
            : "No relevant passages found",
        createdAt: new Date().toISOString(),
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: chunks.length > 0 ? buildContextFromChunks(chunks) : "No relevant passages found.",
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(
    "The drafting agent used too many search steps without finishing — try again with more specific instructions.",
  );
}

export interface DraftingAgentResult {
  content: string;
  trace: AgentTraceStep[];
  iterations: number;
}

// Self-checking drafting agent: drafts, then — instead of stopping — runs
// its own citation check against the matter's real documents and, if it
// finds a citation that doesn't match anything real, asks itself to fix
// or remove it. Bounded to a few revision rounds, not unlimited
// self-improvement.
export async function runDraftingAgent(
  matterId: string,
  draftType: DraftType,
  instructions: string,
  context: string,
): Promise<DraftingAgentResult> {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    throw new Error(
      "The self-checking drafting agent needs an Anthropic API key (Settings > AI model) — it isn't available through the OpenAI fallback. Use the regular \"Generate draft\" instead, or add an Anthropic key.",
    );
  }
  const client = new Anthropic({ apiKey });

  // The search_matter_documents tool reads from document_chunks, which is
  // otherwise only populated lazily the first time chat is used on a
  // matter (see getMatterChatContext) — without this, the tool would
  // silently return "no relevant passages" on a matter's very first
  // agentic draft, before anything else had ever triggered chunking.
  const documents = await listDocuments(matterId);
  const referenceDocs = await listAttachedReferenceDocuments(matterId);
  await Promise.all([
    ...documents.filter((doc) => isExtractableDocument(doc.fileName)).map((doc) => ensureDocumentChunks(doc)),
    ...referenceDocs
      .filter((doc) => isExtractableDocument(doc.fileName))
      .map((doc) => ensureReferenceDocumentChunks(doc)),
  ]);

  const knownFilenames = [
    ...documents.map((doc) => doc.fileName),
    ...referenceDocs.map((doc) => doc.fileName),
  ];

  const system = `${buildDraftSystemPrompt(draftType)}\n\nYou have a search_matter_documents tool — use it to double-check a fact or find the right source before citing it, rather than guessing.`;
  const trace: AgentTraceStep[] = [];
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildDraftUserPrompt(draftType, context, instructions) },
  ];

  let content = await runToolLoop(client, system, messages, matterId, trace);

  let iterations = 0;
  while (iterations < MAX_REVISION_ROUNDS) {
    const unverified = verifyCitations(content, knownFilenames).filter((c) => !c.verified);
    if (unverified.length === 0) break;

    iterations++;
    const filenames = [...new Set(unverified.map((c) => c.filename))];
    trace.push({
      type: "revision",
      detail: `Found citation(s) that don't match any real document (${filenames.join(", ")}) — asking the agent to fix or remove them`,
      createdAt: new Date().toISOString(),
    });
    messages.push({
      role: "user",
      content: `The following citations in your draft don't match any real uploaded document: ${filenames
        .map((f) => `"${f}"`)
        .join(", ")}. Search the matter's documents again to find the correct source, or rewrite that part to remove the false citation and mark it "[NEEDS LAWYER INPUT]" instead. Return the full corrected draft, not just the changed part.`,
    });
    content = await runToolLoop(client, system, messages, matterId, trace);
  }

  trace.push({
    type: "final",
    detail:
      iterations > 0
        ? `Finished after ${iterations} self-correction round(s)`
        : "Finished with all citations verified on the first pass",
    createdAt: new Date().toISOString(),
  });

  return { content, trace, iterations };
}
