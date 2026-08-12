import { createHash } from "crypto";
import { recordAuditEvent } from "./auditLog";
import {
  createAccessToken,
  markAccessTokenUsed,
  revokeAccessTokensForResource,
} from "./clientAccess";
import db, { toPlain } from "./db";
import { isEmailConfigured, sendEmail } from "./email";

// Retainer agreements, conflict waivers and privacy consents that need a
// client signature. A basic electronic signature (typed legal name plus an
// optional drawn image) — not a qualified/advanced e-signature scheme with
// certificate-backed identity. documentHash pins down exactly what was
// signed so the record can be checked against the source document later.

export type SignableDocumentKind = "retainer" | "conflict_waiver" | "privacy_consent" | "custom";

export type SignableDocumentStatus =
  | "draft"
  | "sent"
  | "signed"
  | "declined"
  | "voided"
  | "expired";

export interface SignableDocument {
  id: string;
  matterId: string;
  kind: SignableDocumentKind;
  title: string;
  sourceDocumentId: string | null;
  status: SignableDocumentStatus;
  createdAt: string;
  createdByUserId: string | null;
  sentAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
}

export interface Signature {
  id: string;
  signableDocumentId: string;
  signerName: string;
  signerEmail: string | null;
  signatureText: string;
  signatureImage: string | null;
  documentHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  signedAt: string;
}

export const SIGNABLE_DOCUMENT_KINDS: SignableDocumentKind[] = [
  "retainer",
  "conflict_waiver",
  "privacy_consent",
  "custom",
];

export const SIGNABLE_KIND_LABELS: Record<SignableDocumentKind, string> = {
  retainer: "Retainer agreement",
  conflict_waiver: "Conflict waiver",
  privacy_consent: "Privacy consent",
  custom: "Other document",
};

export async function listSignableDocuments(matterId: string): Promise<SignableDocument[]> {
  return db
    .prepare("SELECT * FROM signable_documents WHERE matterId = ? ORDER BY createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<SignableDocument>(row));
}

export async function getSignableDocument(id: string): Promise<SignableDocument | null> {
  const row = db.prepare("SELECT * FROM signable_documents WHERE id = ?").get(id);
  return row ? toPlain<SignableDocument>(row) : null;
}

export async function listSignatures(signableDocumentId: string): Promise<Signature[]> {
  return db
    .prepare("SELECT * FROM signatures WHERE signableDocumentId = ? ORDER BY signedAt ASC")
    .all(signableDocumentId)
    .map((row) => toPlain<Signature>(row));
}

export async function createSignableDocument(
  matterId: string,
  kind: SignableDocumentKind,
  title: string,
  sourceDocumentId: string | null,
  createdByUserId: string | null,
): Promise<SignableDocument> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("A title is required.");
  }
  if (!SIGNABLE_DOCUMENT_KINDS.includes(kind)) {
    throw new Error("Pick a document kind.");
  }
  if (sourceDocumentId) {
    const source = db
      .prepare("SELECT id FROM documents WHERE id = ? AND matterId = ?")
      .get(sourceDocumentId, matterId);
    if (!source) {
      throw new Error("The selected source document isn't part of this matter.");
    }
  }

  const document: SignableDocument = {
    id: crypto.randomUUID(),
    matterId,
    kind,
    title: trimmedTitle,
    sourceDocumentId: sourceDocumentId || null,
    status: "draft",
    createdAt: new Date().toISOString(),
    createdByUserId,
    sentAt: null,
    signedAt: null,
    declinedAt: null,
  };
  db.prepare(
    "INSERT INTO signable_documents (id, matterId, kind, title, sourceDocumentId, status, createdAt, createdByUserId, sentAt, signedAt, declinedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    document.id,
    document.matterId,
    document.kind,
    document.title,
    document.sourceDocumentId,
    document.status,
    document.createdAt,
    document.createdByUserId,
    document.sentAt,
    document.signedAt,
    document.declinedAt,
  );
  await recordAuditEvent(
    "signable_document_created",
    matterId,
    `Prepared ${SIGNABLE_KIND_LABELS[kind].toLowerCase()} "${document.title}" for signature`,
  );
  return document;
}

// Raw query rather than importing matters.ts — that module already imports
// this one (createSignableDocument, sendForSignature for invoice approval),
// so importing back would be circular.
function getMatterContactInfo(matterId: string): { clientEmail: string | null; clientName: string; title: string } | undefined {
  return db
    .prepare("SELECT clientEmail, clientName, title FROM matters WHERE id = ?")
    .get(matterId) as { clientEmail: string | null; clientName: string; title: string } | undefined;
}

// Sends the signing link straight to the client's email on file, if one
// exists and SMTP is configured — best-effort: a failed/skipped email never
// blocks issuing the link, since the copy-link fallback (every caller still
// shows it) covers both "no email configured" and "the send itself failed."
async function emailSigningLink(
  matterId: string,
  title: string,
  signUrl: string,
): Promise<string | null> {
  if (!(await isEmailConfigured())) return null;
  const matter = getMatterContactInfo(matterId);
  if (!matter?.clientEmail) return null;

  try {
    await sendEmail({
      to: matter.clientEmail,
      subject: `Please review and sign: ${title}`,
      text: `Hello ${matter.clientName},\n\n${title} is ready for your review and signature.\n\nOpen this link to review and sign:\n${signUrl}\n\nIf you weren't expecting this, contact your lawyer before clicking the link.`,
      html: `<p>Hello ${matter.clientName},</p><p><strong>${title}</strong> is ready for your review and signature.</p><p><a href="${signUrl}">Click here to review and sign</a></p><p style="color:#666;font-size:13px;">If you weren't expecting this, contact your lawyer before clicking the link.</p>`,
    });
    return matter.clientEmail;
  } catch {
    // Swallowed deliberately — the caller still gets a working signUrl to
    // copy and send manually, so a bad SMTP config here isn't fatal to the
    // actual goal (get a link to the client).
    return null;
  }
}

// Returns the freshly-issued token alongside the updated document — the
// caller turns it into a /sign/<token> link. Tokens are deliberately never
// served back on a subsequent read: a lost link is re-issued here (which
// revokes the old one), rather than the same secret being handed out again
// on every page load. baseUrl (the app's own origin, e.g. from
// `new URL(request.url).origin` in the calling route) is required to
// actually email the link — without it there's no absolute URL to send, so
// the caller falls back to copy-link-only.
export async function sendForSignature(
  id: string,
  createdByUserId: string | null,
  baseUrl?: string,
): Promise<{ document: SignableDocument; token: string; emailedTo: string | null }> {
  const document = await getSignableDocument(id);
  if (!document) {
    throw new Error("Signable document not found.");
  }
  if (document.status === "signed") {
    throw new Error("This document has already been signed.");
  }
  if (document.status === "voided") {
    throw new Error("This document has been voided. Prepare a new one instead.");
  }

  revokeAccessTokensForResource(id);
  const token = createAccessToken("signature", document.matterId, id, createdByUserId);
  const sentAt = new Date().toISOString();
  db.prepare(
    "UPDATE signable_documents SET status = 'sent', sentAt = ?, declinedAt = NULL WHERE id = ?",
  ).run(sentAt, id);

  const emailedTo = baseUrl
    ? await emailSigningLink(document.matterId, document.title, `${baseUrl}/sign/${token}`)
    : null;

  await recordAuditEvent(
    "signable_document_sent",
    document.matterId,
    `Issued a signing link for "${document.title}"${emailedTo ? ` and emailed it to ${emailedTo}` : ""}`,
  );
  return {
    document: { ...document, status: "sent", sentAt, declinedAt: null },
    token,
    emailedTo,
  };
}

// What the signature attests to. A source document's contentHash is already
// the sha256 of its plaintext bytes as uploaded (see addDocument in
// matters.ts), so it's reused here rather than decrypting the file again to
// arrive at the same digest. With no source document attached there's no
// file to hash, so the document's own identity is hashed instead — enough
// to detect the title or kind being changed after the fact.
function computeDocumentHash(document: SignableDocument): string {
  if (document.sourceDocumentId) {
    const source = db
      .prepare("SELECT contentHash FROM documents WHERE id = ?")
      .get(document.sourceDocumentId) as unknown as { contentHash: string } | undefined;
    if (source) return source.contentHash;
  }
  return createHash("sha256")
    .update(`${document.matterId}:${document.kind}:${document.title}`)
    .digest("hex");
}

export interface SignatureSubmission {
  // Only set for the token-link signing path (/sign/[token]) — a portal
  // session has nothing to mark used, since it never had a token to begin
  // with (see PortalSignableDocumentsPanel.tsx).
  token?: string | null;
  signerName: string;
  signerEmail?: string | null;
  signatureText: string;
  signatureImage?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function submitSignature(
  id: string,
  input: SignatureSubmission,
): Promise<Signature> {
  const document = await getSignableDocument(id);
  if (!document) {
    throw new Error("Signable document not found.");
  }
  // The status field — not the token's usedAt — is the gate against
  // double-submission, so a client can reload the signing page freely right
  // up until they actually sign.
  if (document.status !== "sent") {
    throw new Error(
      document.status === "signed"
        ? "This document has already been signed."
        : "This document isn't currently open for signature.",
    );
  }

  const signerName = input.signerName.trim();
  const signatureText = input.signatureText.trim();
  if (!signerName) {
    throw new Error("Type your full legal name to sign.");
  }
  if (!signatureText) {
    throw new Error("A signature is required.");
  }

  const signature: Signature = {
    id: crypto.randomUUID(),
    signableDocumentId: id,
    signerName,
    signerEmail: input.signerEmail?.trim() || null,
    signatureText,
    signatureImage: input.signatureImage || null,
    documentHash: computeDocumentHash(document),
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
    signedAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO signatures (id, signableDocumentId, signerName, signerEmail, signatureText, signatureImage, documentHash, ipAddress, userAgent, signedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    signature.id,
    signature.signableDocumentId,
    signature.signerName,
    signature.signerEmail,
    signature.signatureText,
    signature.signatureImage,
    signature.documentHash,
    signature.ipAddress,
    signature.userAgent,
    signature.signedAt,
  );

  db.prepare("UPDATE signable_documents SET status = 'signed', signedAt = ? WHERE id = ?").run(
    signature.signedAt,
    id,
  );
  if (input.token) markAccessTokenUsed(input.token);

  await recordAuditEvent(
    "signable_document_signed",
    document.matterId,
    `${signature.signerName} signed "${document.title}"`,
  );
  return signature;
}

export async function declineSignature(id: string, reason?: string): Promise<SignableDocument> {
  const document = await getSignableDocument(id);
  if (!document) {
    throw new Error("Signable document not found.");
  }
  if (document.status === "signed") {
    throw new Error("This document has already been signed.");
  }

  const declinedAt = new Date().toISOString();
  db.prepare(
    "UPDATE signable_documents SET status = 'declined', declinedAt = ? WHERE id = ?",
  ).run(declinedAt, id);
  // The outstanding link is spent either way — the status check above would
  // reject it, but revoking stops it resolving at all.
  revokeAccessTokensForResource(id);

  const trimmedReason = reason?.trim();
  await recordAuditEvent(
    "signable_document_declined",
    document.matterId,
    `Recorded "${document.title}" as declined${trimmedReason ? `: ${trimmedReason}` : ""}`,
  );
  return { ...document, status: "declined", declinedAt };
}

export async function voidSignableDocument(id: string): Promise<SignableDocument> {
  const document = await getSignableDocument(id);
  if (!document) {
    throw new Error("Signable document not found.");
  }

  db.prepare("UPDATE signable_documents SET status = 'voided' WHERE id = ?").run(id);
  revokeAccessTokensForResource(id);

  await recordAuditEvent(
    "signable_document_voided",
    document.matterId,
    `Voided "${document.title}"`,
  );
  return { ...document, status: "voided" };
}
