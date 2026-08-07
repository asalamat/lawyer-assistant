import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMatter } from "@/lib/matters";
import {
  createSignableDocument,
  listSignableDocuments,
  type SignableDocumentKind,
} from "@/lib/signableDocuments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const documents = await listSignableDocuments(id);
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

  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  const title = body?.title;
  if (typeof kind !== "string") {
    return NextResponse.json({ error: "kind is required" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const sourceDocumentId = typeof body?.sourceDocumentId === "string" ? body.sourceDocumentId : null;

  const user = await getCurrentUser();
  try {
    const document = await createSignableDocument(
      id,
      kind as SignableDocumentKind,
      title,
      sourceDocumentId,
      user?.id ?? null,
    );
    return NextResponse.json(document, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to prepare document" },
      { status: 400 },
    );
  }
}
