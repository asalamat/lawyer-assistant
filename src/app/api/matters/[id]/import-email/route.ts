import { NextResponse } from "next/server";
import { importEmailAsDocument } from "@/lib/emailImport";
import { checkForNewDeadlines, checkMatterClassification, getMatter, listDocuments } from "@/lib/matters";
import { EMAIL_PROVIDERS, type EmailProvider } from "@/lib/types";

// Past this many existing documents, checkForNewDeadlines()/checkMatterClassification()
// read the matter's full corpus and can take 20s to several minutes — the same
// slowness import-email/bulk/route.ts already backgrounds this for. Below the
// threshold (the common case — importing into a typical, lightly-populated
// matter) this stays synchronous so the immediate "Found N new deadlines"
// feedback the UI shows keeps working.
const LARGE_MATTER_DOCUMENT_THRESHOLD = 20;

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
  const messageId = body?.messageId;
  const folderId = typeof body?.folderId === "string" ? body.folderId : undefined;

  if (!EMAIL_PROVIDERS.includes(provider as EmailProvider)) {
    return NextResponse.json({ error: "Unknown or missing provider" }, { status: 400 });
  }
  if (typeof messageId !== "string" || messageId.length === 0) {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }

  let document;
  try {
    document = await importEmailAsDocument(id, provider as EmailProvider, messageId, folderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch the email";
    const clientError =
      message.includes("is connected") || message.includes("not supported");
    return NextResponse.json({ error: message }, { status: clientError ? 400 : 502 });
  }

  const documentCount = (await listDocuments(id)).length;
  let newDeadlines: number | null = 0;
  let classificationSuggestion = null;
  if (documentCount > LARGE_MATTER_DOCUMENT_THRESHOLD) {
    void checkForNewDeadlines(id).catch(() => {});
    void checkMatterClassification(id).catch(() => {});
    newDeadlines = null;
  } else {
    try {
      newDeadlines = (await checkForNewDeadlines(id)).newCount;
    } catch {
      newDeadlines = 0;
    }
    try {
      classificationSuggestion = await checkMatterClassification(id);
    } catch {
      classificationSuggestion = null;
    }
  }

  return NextResponse.json({ ...document, newDeadlines, classificationSuggestion }, { status: 201 });
}
