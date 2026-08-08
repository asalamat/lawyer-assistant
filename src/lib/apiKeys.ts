import { createHash, randomBytes, randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { ApiKey } from "./types";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// The public columns only — keyHash is never selected here, same
// discipline as listEmailAccounts() never selecting accessToken.
const PUBLIC_COLUMNS = "id, label, createdByUserId, createdAt, lastUsedAt, revokedAt";

export async function listApiKeys(): Promise<ApiKey[]> {
  return db
    .prepare(`SELECT ${PUBLIC_COLUMNS} FROM api_keys ORDER BY createdAt DESC`)
    .all()
    .map((row) => toPlain<ApiKey>(row));
}

// Returns the real key exactly once — callers must show it to the user
// immediately and never retrieve it again (only the hash is stored).
export async function createApiKey(label: string, userId: string | null): Promise<{ apiKey: ApiKey; key: string }> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("Label is required");

  const key = `lak_${randomBytes(24).toString("hex")}`;
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO api_keys (id, label, keyHash, createdByUserId, createdAt, lastUsedAt, revokedAt) VALUES (?, ?, ?, ?, ?, NULL, NULL)",
  ).run(id, trimmed, hashKey(key), userId, createdAt);

  await recordAuditEvent("api_key_created", null, `Generated API key "${trimmed}"`);

  return {
    apiKey: { id, label: trimmed, createdByUserId: userId, createdAt, lastUsedAt: null, revokedAt: null },
    key,
  };
}

export async function revokeApiKey(id: string): Promise<void> {
  const row = db.prepare("SELECT label FROM api_keys WHERE id = ?").get(id) as { label: string } | undefined;
  db.prepare("UPDATE api_keys SET revokedAt = ? WHERE id = ? AND revokedAt IS NULL").run(
    new Date().toISOString(),
    id,
  );
  if (row) {
    await recordAuditEvent("api_key_revoked", null, `Revoked API key "${row.label}"`);
  }
}

// Used by the /api/v1/* route handlers themselves, not by proxy.ts — this
// app's shared middleware handles the staff-session/matter-access/admin
// logic that doesn't apply to a machine credential at all, so the external
// API surface authenticates itself the same way the existing cron-secret
// endpoints do (public at the middleware level, self-checked in the route).
export async function verifyApiKey(key: string): Promise<boolean> {
  if (!key) return false;
  const row = db
    .prepare("SELECT id, revokedAt FROM api_keys WHERE keyHash = ?")
    .get(hashKey(key)) as { id: string; revokedAt: string | null } | undefined;
  if (!row || row.revokedAt) return false;

  db.prepare("UPDATE api_keys SET lastUsedAt = ? WHERE id = ?").run(new Date().toISOString(), row.id);
  return true;
}
