import { randomUUID } from "crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";

// Optional alternative to password login — a user can register one or more
// passkeys (Settings > Security) and sign in with one instead of typing a
// password. Never stores anything secret: the stored publicKey is exactly
// that, public — the actual private key never leaves the authenticator
// (device biometric, security key, password manager).

export interface WebauthnCredentialRecord {
  id: string;
  userId: string;
  credentialId: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface CredentialRow {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
}

// The RP ID (relying party identifier) must be the exact hostname the
// browser used to reach this app — WebAuthn ties a passkey to one hostname,
// so a passkey registered via "localhost" won't work via "127.0.0.1" or a
// LAN IP, even for the same running instance. Derived from the actual
// request rather than hardcoded, same pattern as DocuSign's origin handling.
function rpIdFromOrigin(origin: string): string {
  return new URL(origin).hostname;
}

export async function listCredentials(userId: string): Promise<WebauthnCredentialRecord[]> {
  return db
    .prepare(
      "SELECT id, userId, credentialId, label, createdAt, lastUsedAt FROM webauthn_credentials WHERE userId = ? ORDER BY createdAt DESC",
    )
    .all(userId)
    .map((row) => toPlain<WebauthnCredentialRecord>(row));
}

export async function deleteCredential(userId: string, id: string): Promise<boolean> {
  const result = db.prepare("DELETE FROM webauthn_credentials WHERE id = ? AND userId = ?").run(id, userId);
  if (result.changes > 0) {
    await recordAuditEvent("passkey_removed", null, "Removed a passkey");
  }
  return result.changes > 0;
}

export async function generatePasskeyRegistrationOptions(
  user: { id: string; email: string; name: string },
  origin: string,
) {
  const existing = db
    .prepare("SELECT credentialId, transports FROM webauthn_credentials WHERE userId = ?")
    .all(user.id) as { credentialId: string; transports: string | null }[];

  return generateRegistrationOptions({
    rpName: "Lawyer Assistant",
    rpID: rpIdFromOrigin(origin),
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
}

export async function verifyPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  origin: string,
  label: string,
): Promise<void> {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpIdFromOrigin(origin),
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("This passkey could not be verified. Try again.");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const trimmedLabel = label.trim() || "Passkey";
  db.prepare(
    `INSERT INTO webauthn_credentials
       (id, userId, credentialId, publicKey, counter, deviceType, backedUp, transports, label, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    userId,
    credential.id,
    Buffer.from(credential.publicKey).toString("base64"),
    credential.counter,
    credentialDeviceType,
    credentialBackedUp ? 1 : 0,
    credential.transports ? JSON.stringify(credential.transports) : null,
    trimmedLabel,
    new Date().toISOString(),
  );
  await recordAuditEvent("passkey_registered", null, `Registered a passkey ("${trimmedLabel}")`);
}

// allowCredentials is deliberately omitted — this is the discoverable-
// credential ("passwordless") flow: the browser's own passkey picker shows
// whichever passkeys it has for this origin, and the response tells us
// which one was used, rather than the server needing to know the user
// ahead of time the way a password login does.
export async function generatePasskeyAuthenticationOptions(origin: string) {
  return generateAuthenticationOptions({
    rpID: rpIdFromOrigin(origin),
    userVerification: "preferred",
  });
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  origin: string,
): Promise<{ userId: string }> {
  const row = db.prepare("SELECT * FROM webauthn_credentials WHERE credentialId = ?").get(response.id) as
    | CredentialRow
    | undefined;
  if (!row) {
    throw new Error("This passkey isn't registered with this app.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpIdFromOrigin(origin),
    credential: {
      id: row.credentialId,
      publicKey: new Uint8Array(Buffer.from(row.publicKey, "base64")),
      counter: row.counter,
      transports: row.transports ? JSON.parse(row.transports) : undefined,
    },
  });
  if (!verification.verified) {
    throw new Error("Passkey verification failed.");
  }

  // newCounter tracks how many times this authenticator reports it has been
  // used — a value that doesn't advance on a later login is a signature of
  // a cloned authenticator, which verifyAuthenticationResponse itself
  // already checks; persisting it here is what makes that check meaningful
  // on the *next* login instead of just this one.
  db.prepare("UPDATE webauthn_credentials SET counter = ?, lastUsedAt = ? WHERE id = ?").run(
    verification.authenticationInfo.newCounter,
    new Date().toISOString(),
    row.id,
  );

  return { userId: row.userId };
}
