import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientSessionUser } from "@/lib/clientAuth";
import { getMatter } from "@/lib/matters";
import {
  getSignableDocument,
  SIGNABLE_KIND_LABELS,
  submitSignature,
} from "@/lib/signableDocuments";

// Portal-session-authorized equivalent of /api/sign/[token] — same shape,
// but the client is already logged in, so there's no token, just a check
// that the requested document actually belongs to their matter.
async function authorize(
  matterIdParam: string,
  docId: string,
): Promise<
  | { ok: true; document: NonNullable<Awaited<ReturnType<typeof getSignableDocument>>>; clientUserEmail: string; clientName: string | null }
  | { ok: false; response: NextResponse }
> {
  const token = (await cookies()).get("client_session")?.value;
  const clientUser = await getClientSessionUser(token);
  if (!clientUser) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const matter = await getMatter(matterIdParam);
  if (!matter || matter.clientId !== clientUser.clientId) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const document = await getSignableDocument(docId);
  if (!document || document.matterId !== matterIdParam) {
    return { ok: false, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  return { ok: true, document, clientUserEmail: clientUser.email, clientName: matter.clientName };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const result = await authorize(id, docId);
  if (!result.ok) return result.response;

  return NextResponse.json({
    title: result.document.title,
    kind: result.document.kind,
    kindLabel: SIGNABLE_KIND_LABELS[result.document.kind] ?? result.document.kind,
    status: result.document.status,
    clientName: result.clientName,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params;
  const result = await authorize(id, docId);
  if (!result.ok) return result.response;

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
    const signature = await submitSignature(docId, {
      signerName,
      signerEmail:
        typeof body?.signerEmail === "string" && body.signerEmail.trim()
          ? body.signerEmail
          : result.clientUserEmail,
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
