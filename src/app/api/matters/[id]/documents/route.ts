import { NextResponse } from "next/server";
import {
  addDocument,
  analyzeDocumentPhoto,
  checkForNewDeadlines,
  checkMatterClassification,
  checkNearDuplicateOnUpload,
  getDocument,
  getMatter,
  listDocuments,
} from "@/lib/matters";
import { isImageFile, isSafeToExtract } from "@/lib/textExtraction";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const documents = await listDocuments(id);
  return NextResponse.json(documents);
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

  let file: File;
  try {
    const formData = await request.formData();
    const formFile = formData.get("file");
    if (!(formFile instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    file = formFile;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read the uploaded file" },
      { status: 400 },
    );
  }

  const document = await addDocument(id, file);

  // Deadline-monitoring agent: re-checks automatically right after a new
  // readable document lands, instead of waiting for a manual re-extract
  // click. Best-effort — a failure here (e.g. no AI key configured yet)
  // shouldn't fail the upload itself, which already succeeded.
  let newDeadlines = 0;
  let classificationSuggestion = null;
  let nearDuplicate = null;
  if (isSafeToExtract(document)) {
    // Runs before the checks below on purpose: near-duplicate detection and
    // deadline extraction can both trigger this document's first (and only,
    // since it's idempotent) chunking pass — the photo description needs to
    // already be on the row before that happens, or it never makes it into
    // chat retrieval (see the merge in extractionStatus.ts).
    if (isImageFile(document.fileName)) {
      try {
        await analyzeDocumentPhoto(id, document.id);
      } catch {
        // analyzeDocumentPhoto already records failure on the row itself.
      }
    }
    try {
      newDeadlines = (await checkForNewDeadlines(id)).newCount;
    } catch {
      newDeadlines = 0;
    }
    // Intake agent — same best-effort treatment as the deadline check.
    try {
      classificationSuggestion = await checkMatterClassification(id);
    } catch {
      classificationSuggestion = null;
    }
    // Near-duplicate check — same best-effort treatment; needs an OpenAI
    // key configured for embeddings, so a missing key shouldn't fail the
    // upload that already succeeded.
    try {
      nearDuplicate = await checkNearDuplicateOnUpload(id, document.id);
    } catch {
      nearDuplicate = null;
    }
  }

  // Re-fetch rather than returning the pre-checks `document` object — photo
  // analysis (and extraction) mutate the row in between, so the response
  // would otherwise report stale nulls for fields that were, in fact, set.
  const finalDocument = (await getDocument(id, document.id)) ?? document;

  return NextResponse.json(
    { ...finalDocument, newDeadlines, classificationSuggestion, nearDuplicate },
    { status: 201 },
  );
}
