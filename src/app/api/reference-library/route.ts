import { NextResponse } from "next/server";
import { addReferenceDocument, listReferenceDocuments } from "@/lib/referenceLibrary";
import { REFERENCE_DOCUMENT_CATEGORIES, type ReferenceDocumentCategory } from "@/lib/types";

export async function GET() {
  const documents = await listReferenceDocuments();
  return NextResponse.json(documents);
}

export async function POST(request: Request) {
  let file: File;
  let category: ReferenceDocumentCategory = "firm_knowledge";
  try {
    const formData = await request.formData();
    const formFile = formData.get("file");
    if (!(formFile instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    file = formFile;
    const formCategory = formData.get("category");
    if (
      typeof formCategory === "string" &&
      REFERENCE_DOCUMENT_CATEGORIES.includes(formCategory as ReferenceDocumentCategory)
    ) {
      category = formCategory as ReferenceDocumentCategory;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read the uploaded file" },
      { status: 400 },
    );
  }

  const document = await addReferenceDocument(file, category);
  return NextResponse.json(document, { status: 201 });
}
