import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import db from "./db";
import type { ClientUser } from "./types";

// A persistent client-portal account — a distinct identity realm from the
// staff users table (see auth.ts), with its own session cookie
// ("client_session", set by the /api/portal/* routes) and no role/matter
// access model of its own: a portal account can only ever see its own
// client's matters, enforced by scoping every query to clientUser.clientId
// rather than by anything resembling the staff permission system.

interface ClientUserRow extends ClientUser {
  passwordHash: string;
  passwordSalt: string;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Same sliding-window idle timeout as the staff session (auth.ts) — a
// portal client walking away from a shared/public computer shouldn't leave
// their matter documents open indefinitely either.
const IDLE_TIMEOUT_MS = 2 * 60 * 1000;

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function passwordMatches(candidate: string, salt: string, storedHashHex: string): boolean {
  const candidateBuf = Buffer.from(hashPassword(candidate, salt), "hex");
  const storedBuf = Buffer.from(storedHashHex, "hex");
  if (candidateBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(candidateBuf, storedBuf);
}

function stripPassword(row: ClientUserRow): ClientUser {
  const { passwordHash, passwordSalt, ...user } = row;
  void passwordHash;
  void passwordSalt;
  return user;
}

async function getClientUserRowByEmail(email: string): Promise<ClientUserRow | undefined> {
  return db.prepare("SELECT * FROM client_users WHERE email = ?").get(email.trim().toLowerCase()) as
    | ClientUserRow
    | undefined;
}

export async function getClientUserForClient(clientId: string): Promise<ClientUser | null> {
  const row = db.prepare("SELECT * FROM client_users WHERE clientId = ?").get(clientId) as
    | ClientUserRow
    | undefined;
  return row ? stripPassword(row) : null;
}

// One account per client for now — the client entity itself logs in, not a
// named individual contact. If one already exists, this rotates its
// password instead of erroring, so "grant access" doubles as "reset
// password" from the caller's point of view (see the portal-access route).
export async function grantOrResetPortalAccess(
  clientId: string,
  email: string,
): Promise<{ user: ClientUser; temporaryPassword: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email is required");

  const existingForOtherClient = await getClientUserRowByEmail(normalizedEmail);
  if (existingForOtherClient && existingForOtherClient.clientId !== clientId) {
    throw new Error("A portal account with this email already exists for a different client");
  }

  const temporaryPassword = randomBytes(9).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(temporaryPassword, salt);

  const existing = await getClientUserForClient(clientId);
  if (existing) {
    db.prepare(
      "UPDATE client_users SET email = ?, passwordHash = ?, passwordSalt = ?, mustChangePassword = 1, active = 1 WHERE id = ?",
    ).run(normalizedEmail, passwordHash, salt, existing.id);
    await invalidateClientUserSessions(existing.id);
    const user = await getClientUserForClient(clientId);
    return { user: user as ClientUser, temporaryPassword };
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO client_users (id, clientId, email, passwordHash, passwordSalt, mustChangePassword, active, createdAt)
     VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
  ).run(id, clientId, normalizedEmail, passwordHash, salt, new Date().toISOString());

  const user = await getClientUserForClient(clientId);
  return { user: user as ClientUser, temporaryPassword };
}

export async function verifyClientLogin(email: string, password: string): Promise<ClientUser | null> {
  const row = await getClientUserRowByEmail(email);
  if (!row || !row.active) return null;
  if (!passwordMatches(password, row.passwordSalt, row.passwordHash)) return null;
  return stripPassword(row);
}

export async function changeClientPassword(
  clientUserId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const row = db.prepare("SELECT * FROM client_users WHERE id = ?").get(clientUserId) as
    | ClientUserRow
    | undefined;
  if (!row || !passwordMatches(currentPassword, row.passwordSalt, row.passwordHash)) return false;

  const salt = randomBytes(16).toString("hex");
  db.prepare(
    "UPDATE client_users SET passwordHash = ?, passwordSalt = ?, mustChangePassword = 0 WHERE id = ?",
  ).run(hashPassword(newPassword, salt), salt, clientUserId);
  return true;
}

export async function createClientSession(clientUserId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare(
    "INSERT INTO client_sessions (tokenHash, clientUserId, createdAt, expiresAt, lastActivityAt) VALUES (?, ?, ?, ?, ?)",
  ).run(
    hashToken(token),
    clientUserId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
    new Date(now).toISOString(),
  );
  return token;
}

export async function getClientSessionUser(token: string | undefined): Promise<ClientUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT cu.id, cu.clientId, cu.email, cu.mustChangePassword, cu.active, cu.createdAt,
              cs.expiresAt as expiresAt, cs.lastActivityAt as lastActivityAt
       FROM client_sessions cs JOIN client_users cu ON cu.id = cs.clientUserId
       WHERE cs.tokenHash = ?`,
    )
    .get(tokenHash) as (ClientUser & { expiresAt: string; lastActivityAt: string | null }) | undefined;
  if (!row) return null;

  const now = Date.now();
  if (new Date(row.expiresAt).getTime() < now) {
    db.prepare("DELETE FROM client_sessions WHERE tokenHash = ?").run(tokenHash);
    return null;
  }
  if (row.lastActivityAt && now - new Date(row.lastActivityAt).getTime() > IDLE_TIMEOUT_MS) {
    db.prepare("DELETE FROM client_sessions WHERE tokenHash = ?").run(tokenHash);
    return null;
  }
  if (!row.active) return null;

  db.prepare("UPDATE client_sessions SET lastActivityAt = ? WHERE tokenHash = ?").run(
    new Date(now).toISOString(),
    tokenHash,
  );

  const { expiresAt, lastActivityAt, ...user } = row;
  void expiresAt;
  void lastActivityAt;
  return user;
}

export async function clearClientSession(token: string | undefined): Promise<void> {
  if (!token) return;
  db.prepare("DELETE FROM client_sessions WHERE tokenHash = ?").run(hashToken(token));
}

export async function invalidateClientUserSessions(clientUserId: string): Promise<void> {
  db.prepare("DELETE FROM client_sessions WHERE clientUserId = ?").run(clientUserId);
}
