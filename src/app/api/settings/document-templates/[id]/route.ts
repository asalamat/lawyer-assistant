import { NextResponse } from "next/server";
import { deleteDocumentTemplate } from "@/lib/documentTemplates";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await deleteDocumentTemplate(id);
  return NextResponse.json({ success: true });
}
