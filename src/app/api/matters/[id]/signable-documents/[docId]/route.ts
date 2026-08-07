import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  declineSignature,
  getSignableDocument,
  listSignatures,
  sendForSignature,
  voidSignableDocument,
} from "@/lib/signableDocuments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const document = await getSignableDocument(docId);
  if (!document || document.matterId !== id) {
    return NextResponse.json({ error: "Signable document not found" }, { status: 404 });
  }
  // No signing link here on purpose — the token is only ever returned by the
  // PATCH that issues it (see sendForSignature). Re-serving the same secret
  // on every read would widen its exposure for no benefit; a lost link is
  // replaced with action: "resend".
  const signatures = await listSignatures(docId);
  return NextResponse.json({ document, signatures });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const document = await getSignableDocument(docId);
  if (!document || document.matterId !== id) {
    return NextResponse.json({ error: "Signable document not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "resend" && action !== "decline" && action !== "void") {
    return NextResponse.json(
      { error: "action must be 'resend', 'decline' or 'void'" },
      { status: 400 },
    );
  }

  try {
    if (action === "resend") {
      const user = await getCurrentUser();
      const { document: updated, token } = await sendForSignature(docId, user?.id ?? null);
      return NextResponse.json({ document: updated, signUrl: `/sign/${token}` });
    }
    if (action === "decline") {
      const reason = typeof body?.reason === "string" ? body.reason : undefined;
      return NextResponse.json({ document: await declineSignature(docId, reason) });
    }
    return NextResponse.json({ document: await voidSignableDocument(docId) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update document" },
      { status: 400 },
    );
  }
}
