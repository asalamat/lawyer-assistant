import { NextResponse } from "next/server";
import { getAssembledDocument, getDocumentTemplate } from "@/lib/documentTemplates";
import { addDocument } from "@/lib/matters";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const assembled = await getAssembledDocument(id, docId);
  if (!assembled) return NextResponse.json({ error: "Generated document not found" }, { status: 404 });

  const template = await getDocumentTemplate(assembled.templateId);
  const fileName = `${template?.name ?? "Generated document"} - ${assembled.createdAt.slice(0, 10)}.txt`;
  const file = new File([new Blob([assembled.content])], fileName, { type: "text/plain" });

  const document = await addDocument(id, file);
  return NextResponse.json(document, { status: 201 });
}
