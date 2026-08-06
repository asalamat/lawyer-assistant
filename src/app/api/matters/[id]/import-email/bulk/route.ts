import { NextResponse } from "next/server";
import { importEmailAsDocument } from "@/lib/emailImport";
import { checkForNewDeadlines, checkMatterClassification, getMatter } from "@/lib/matters";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

interface BulkImportResult {
  messageId: string;
  status: "imported" | "failed";
  documentId?: string;
  fileName?: string;
  error?: string;
}

const MAX_MESSAGES = 100;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const provider = body?.provider;
  const folderId = typeof body?.folderId === "string" ? body.folderId : undefined;
  const messageIds = body?.messageIds;

  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    return NextResponse.json({ error: "Unknown or missing provider" }, { status: 400 });
  }
  if (!Array.isArray(messageIds) || messageIds.length === 0 || !messageIds.every((m) => typeof m === "string")) {
    return NextResponse.json({ error: "messageIds must be a non-empty array of strings" }, { status: 400 });
  }
  if (messageIds.length > MAX_MESSAGES) {
    return NextResponse.json({ error: `Select at most ${MAX_MESSAGES} messages at once` }, { status: 400 });
  }

  // Sequential, same reasoning as bulk ZIP import: each import does real
  // I/O (a network fetch to the mail provider, a disk write, a SQLite
  // write) and the database only supports one writer at a time anyway —
  // running these concurrently would just contend with itself.
  const results: BulkImportResult[] = [];
  for (const messageId of messageIds as string[]) {
    try {
      const document = await importEmailAsDocument(id, provider as EmailProvider, messageId, folderId);
      results.push({ messageId, status: "imported", documentId: document.id, fileName: document.fileName });
    } catch (err) {
      results.push({
        messageId,
        status: "failed",
        error: err instanceof Error ? err.message : "Failed to import",
      });
    }
  }

  // Deliberately NOT awaited — extractDeadlines()/suggestMatterClassification()
  // both read the matter's FULL document corpus, and a bulk import (e.g.
  // "Select all") can add dozens of documents at once, which made this
  // block the response for 20 seconds to several minutes in testing.
  // Firing this in the background lets the import response return as
  // soon as the actual imports are done; the deadline list/classification
  // banner will reflect the batch once this finishes, just not
  // synchronously with this response. Each call already has its own
  // internal try/catch-equivalent via .catch() here — a failure here
  // never surfaces as an error on the (already-sent) response.
  if (results.some((r) => r.status === "imported")) {
    void checkForNewDeadlines(id).catch(() => {});
    void checkMatterClassification(id).catch(() => {});
  }

  return NextResponse.json({ results }, { status: 201 });
}
