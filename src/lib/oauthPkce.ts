import { createHash, randomBytes } from "crypto";

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// PKCE (RFC 7636) — lets a public client (no client secret, e.g. OneDrive's
// app registration below) prove it's the same party that started the OAuth
// flow, without a secret an installed/self-hosted app has nowhere safe to
// keep. The verifier is generated per attempt and never leaves the server;
// only its SHA-256 challenge goes out in the authorize-URL redirect.
export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}
