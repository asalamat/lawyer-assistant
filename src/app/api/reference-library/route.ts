import { NextResponse } from "next/server";
import { addReferenceDocument, listReferenceDocuments } from "@/lib/referenceLibrary";

export async function GET() {
  const documents = await listReferenceDocuments();
  return NextResponse.json(documents);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const document = await addReferenceDocument(file);
  return NextResponse.json(document, { status: 201 });
}
