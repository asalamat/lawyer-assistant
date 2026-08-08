import { NextResponse } from "next/server";
import { generateDocxBuffer, getAssembledDocument, getDocumentTemplate } from "@/lib/documentTemplates";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const assembled = await getAssembledDocument(id, docId);
  if (!assembled) return NextResponse.json({ error: "Generated document not found" }, { status: 404 });

  const template = await getDocumentTemplate(assembled.templateId);
  const fileName = `${template?.name ?? "Generated document"} - ${assembled.createdAt.slice(0, 10)}.docx`;
  const buffer = await generateDocxBuffer(assembled);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
    },
  });
}
