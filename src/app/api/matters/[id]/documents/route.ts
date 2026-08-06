import { NextResponse } from "next/server";
import { addDocument, checkForNewDeadlines, getMatter, listDocuments } from "@/lib/matters";
import { isExtractableDocument } from "@/lib/textExtraction";

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

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const document = await addDocument(id, file);

  // Deadline-monitoring agent: re-checks automatically right after a new
  // readable document lands, instead of waiting for a manual re-extract
  // click. Best-effort — a failure here (e.g. no AI key configured yet)
  // shouldn't fail the upload itself, which already succeeded.
  let newDeadlines = 0;
  if (isExtractableDocument(document.fileName)) {
    try {
      newDeadlines = (await checkForNewDeadlines(id)).newCount;
    } catch {
      newDeadlines = 0;
    }
  }

  return NextResponse.json({ ...document, newDeadlines }, { status: 201 });
}
