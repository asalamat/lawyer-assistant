import { randomBytes } from "crypto";
import db, { toPlain } from "./db";

// Single-purpose, no-login links for clients: sign a document or fill out an
// intake questionnaire. Deliberately not a client portal/account system —
// each token is scoped to exactly one resource, expires, and can be revoked.

export type AccessTokenPurpose = "signature" | "intake";

export interface ClientAccessToken {
  token: string;
  purpose: AccessTokenPurpose;
  matterId: string;
  resourceId: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
}

// Two weeks: long enough for a client to get to it, short enough to bound
// exposure if the link leaks (e.g. forwarded email).
const DEFAULT_TTL_HOURS = 14 * 24;

export function createAccessToken(
  purpose: AccessTokenPurpose,
  matterId: string,
  resourceId: string,
  createdByUserId: string | null,
  ttlHours = DEFAULT_TTL_HOURS,
): string {
  const token = randomBytes(32).toString("hex");
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO client_access_tokens (token, purpose, matterId, resourceId, expiresAt, usedAt, revokedAt, createdAt, createdByUserId) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)",
  ).run(token, purpose, matterId, resourceId, expiresAt, createdAt, createdByUserId);
  return token;
}

// Returns null if the token doesn't exist, is for a different purpose, has
// expired, or was revoked. Does not check/mark single-use — the resource's
// own status field (e.g. signable_documents.status) is the gate against
// double-submission, so a client can safely reload the page before signing.
export function getValidAccessToken(
  token: string,
  purpose: AccessTokenPurpose,
): ClientAccessToken | null {
  const row = db
    .prepare("SELECT * FROM client_access_tokens WHERE token = ? AND purpose = ?")
    .get(token, purpose);
  if (!row) return null;
  const rec = toPlain<ClientAccessToken>(row);
  if (rec.revokedAt) return null;
  if (new Date(rec.expiresAt).getTime() < Date.now()) return null;
  return rec;
}

export function markAccessTokenUsed(token: string): void {
  db.prepare("UPDATE client_access_tokens SET usedAt = ? WHERE token = ?").run(
    new Date().toISOString(),
    token,
  );
}

// Called when re-sending a link for the same resource, so old links stop
// working the moment a new one is issued.
export function revokeAccessTokensForResource(resourceId: string): void {
  db.prepare(
    "UPDATE client_access_tokens SET revokedAt = ? WHERE resourceId = ? AND revokedAt IS NULL",
  ).run(new Date().toISOString(), resourceId);
}
