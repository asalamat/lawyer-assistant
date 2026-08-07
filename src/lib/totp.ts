import { createHmac, randomBytes } from "crypto";

// RFC 6238 (TOTP) on top of RFC 4226 (HOTP), implemented directly on
// node:crypto rather than pulling in a dependency — this app has a standing
// preference for auditable, dependency-free crypto where the primitive is
// simple enough to hand-roll correctly (see the app-password/scrypt auth
// code this sits next to).

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, "0");
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

// Accepts the current 30s step plus one step of drift either side, to
// tolerate clock skew between the server and the user's phone (a real,
// common TOTP issue) without meaningfully widening the attack window
// (~90s total instead of ~30s).
export function verifyTotp(secretBase32: string, token: string, nowSeconds: number = Date.now() / 1000): boolean {
  const cleanToken = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanToken)) return false;
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(nowSeconds / TOTP_STEP_SECONDS);
  for (const drift of [0, -1, 1]) {
    if (hotp(secret, counter + drift) === cleanToken) return true;
  }
  return false;
}

// Most authenticator apps can add an account either by scanning a QR code
// (generated from this same URI) or by manual entry of the secret — this
// app deliberately skips generating an actual QR image (would need a new
// dependency) and shows the secret/URI as text for manual entry instead.
export function generateOtpAuthUri(secretBase32: string, accountEmail: string, issuer = "Lawyer Assistant"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
