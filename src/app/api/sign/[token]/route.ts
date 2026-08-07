import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/clientAccess";
import { getMatter } from "@/lib/matters";
import {
  getSignableDocument,
  SIGNABLE_KIND_LABELS,
  submitSignature,
} from "@/lib/signableDocuments";

// Public, no-login route reached only via a signing link (allowed through
// src/proxy.ts by the "/api/sign/" prefix). Auth is the token itself, so
// this deliberately never calls getSessionUser/getCurrentUser — a client
// has no session. recordAuditEvent tolerates that and simply attributes the
// signature to no user, which is the truthful record here.

// An invalid, revoked or expired token is reported identically, rather than
// telling an unauthenticated caller which of those it is (or that the token
// ever existed at all). The client-facing wording covers every case: ask
// your lawyer for a fresh link.
const INVALID_TOKEN = "This signing link is no longer valid. Ask your lawyer to send a new one.";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const accessToken = getValidAccessToken(token, "signature");
  if (!accessToken) {
    return NextResponse.json({ error: INVALID_TOKEN }, { status: 404 });
  }

  const document = await getSignableDocument(accessToken.resourceId);
  if (!document) {
    return NextResponse.json({ error: INVALID_TOKEN }, { status: 404 });
  }

  const matter = await getMatter(document.matterId);
  return NextResponse.json({
    title: document.title,
    kind: document.kind,
    // Sent pre-labelled so the client-facing page needs no copy of the label
    // map — importing it would pull this app's db layer into that bundle.
    kindLabel: SIGNABLE_KIND_LABELS[document.kind] ?? document.kind,
    status: document.status,
    clientName: matter?.clientName ?? null,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const accessToken = getValidAccessToken(token, "signature");
  if (!accessToken) {
    return NextResponse.json({ error: INVALID_TOKEN }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const signerName = body?.signerName;
  if (typeof signerName !== "string" || !signerName.trim()) {
    return NextResponse.json({ error: "Type your full legal name to sign." }, { status: 400 });
  }
  if (body?.intent !== true) {
    return NextResponse.json(
      { error: "Confirm that you intend this as your legal signature." },
      { status: 400 },
    );
  }

  // Bounded and format-checked even though the caller already holds a valid
  // token — nothing else limits request body size here, and a real canvas
  // export is a few tens of KB, so cap well above that instead of trusting
  // an arbitrary client-supplied string straight into SQLite.
  const MAX_SIGNATURE_IMAGE_LENGTH = 500_000;
  let signatureImage: string | null = null;
  if (typeof body?.signatureImage === "string" && body.signatureImage.length > 0) {
    if (!body.signatureImage.startsWith("data:image/png;base64,")) {
      return NextResponse.json({ error: "Invalid signature image format." }, { status: 400 });
    }
    if (body.signatureImage.length > MAX_SIGNATURE_IMAGE_LENGTH) {
      return NextResponse.json({ error: "Signature image is too large." }, { status: 400 });
    }
    signatureImage = body.signatureImage;
  }

  try {
    const signature = await submitSignature(accessToken.resourceId, {
      token,
      signerName,
      signerEmail: typeof body?.signerEmail === "string" ? body.signerEmail : null,
      signatureText: typeof body?.signatureText === "string" ? body.signatureText : signerName,
      signatureImage,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
      userAgent: request.headers.get("user-agent"),
    });
    return NextResponse.json({ signedAt: signature.signedAt }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record signature" },
      { status: 400 },
    );
  }
}
