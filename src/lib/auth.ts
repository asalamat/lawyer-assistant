import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import db, { toPlain } from "./db";
import { generateOtpAuthUri, generateTotpSecret, verifyTotp } from "./totp";

export type UserRole = "admin" | "lawyer" | "staff";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: number;
  mustChangePassword: number;
  createdAt: string;
}

interface UserRow extends User {
  passwordHash: string;
  passwordSalt: string;
}

// Matches the existing session cookie's maxAge.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

function stripPassword(row: UserRow): User {
  const { passwordHash, passwordSalt, ...user } = row;
  void passwordHash;
  void passwordSalt;
  return user;
}

export async function hasAnyUsers(): Promise<boolean> {
  const { count } = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  return count > 0;
}

export async function listUsers(): Promise<User[]> {
  return db
    .prepare(
      "SELECT id, email, name, role, active, mustChangePassword, createdAt FROM users ORDER BY createdAt ASC",
    )
    .all()
    .map((row) => toPlain<User>(row));
}

export async function getUserById(id: string): Promise<User | null> {
  const row = db
    .prepare(
      "SELECT id, email, name, role, active, mustChangePassword, createdAt FROM users WHERE id = ?",
    )
    .get(id);
  return row ? toPlain<User>(row) : null;
}

async function getUserRowByEmail(email: string): Promise<UserRow | null> {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase());
  return row ? toPlain<UserRow>(row) : null;
}

export async function createUser(input: {
  email: string;
  name: string;
  role: UserRole;
}): Promise<{ user: User; temporaryPassword: string }> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) throw new Error("Email and name are required");
  if (await getUserRowByEmail(email)) throw new Error("A user with this email already exists");

  const id = randomUUID();
  const temporaryPassword = randomBytes(9).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  db.prepare(
    `INSERT INTO users (id, email, name, role, passwordHash, passwordSalt, mustChangePassword, active, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)`,
  ).run(id, email, name, input.role, hashPassword(temporaryPassword, salt), salt, new Date().toISOString());

  const user = (await getUserById(id)) as User;
  return { user, temporaryPassword };
}

// For the very first account on a fresh install (no legacy password to
// migrate either) — sets the password directly rather than going through
// the admin-creates-with-temp-password flow, since there's no admin yet.
export async function bootstrapFirstAdmin(input: {
  email: string;
  name: string;
  password: string;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) throw new Error("Email and name are required");
  if (await getUserRowByEmail(email)) throw new Error("A user with this email already exists");

  const id = randomUUID();
  const salt = randomBytes(16).toString("hex");
  db.prepare(
    `INSERT INTO users (id, email, name, role, passwordHash, passwordSalt, mustChangePassword, active, createdAt)
     VALUES (?, ?, ?, 'admin', ?, ?, 0, 1, ?)`,
  ).run(id, email, name, hashPassword(input.password, salt), salt, new Date().toISOString());

  return (await getUserById(id)) as User;
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, userId);
  if (!active) await invalidateUserSessions(userId);
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
}

export async function resetUserPassword(userId: string): Promise<string> {
  const temporaryPassword = randomBytes(9).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  db.prepare(
    "UPDATE users SET passwordHash = ?, passwordSalt = ?, mustChangePassword = 1 WHERE id = ?",
  ).run(hashPassword(temporaryPassword, salt), salt, userId);
  await invalidateUserSessions(userId);
  return temporaryPassword;
}

export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
  if (!row || !passwordMatches(currentPassword, row.passwordSalt, row.passwordHash)) return false;

  const salt = randomBytes(16).toString("hex");
  db.prepare(
    "UPDATE users SET passwordHash = ?, passwordSalt = ?, mustChangePassword = 0 WHERE id = ?",
  ).run(hashPassword(newPassword, salt), salt, userId);
  return true;
}

export async function verifyLogin(email: string, password: string): Promise<User | null> {
  const row = await getUserRowByEmail(email);
  if (!row || !row.active) return null;
  if (!passwordMatches(password, row.passwordSalt, row.passwordHash)) return null;
  return stripPassword(row);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare("INSERT INTO sessions (tokenHash, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
  );
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, u.active, u.mustChangePassword, u.createdAt, s.expiresAt as expiresAt
       FROM sessions s JOIN users u ON u.id = s.userId
       WHERE s.tokenHash = ?`,
    )
    .get(hashToken(token)) as (User & { expiresAt: string }) | undefined;
  if (!row) return null;

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE tokenHash = ?").run(hashToken(token));
    return null;
  }
  if (!row.active) return null;

  const { expiresAt, ...user } = row;
  void expiresAt;
  return user;
}

export async function clearSession(token: string | undefined): Promise<void> {
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE tokenHash = ?").run(hashToken(token));
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  db.prepare("DELETE FROM sessions WHERE userId = ?").run(userId);
}

const PENDING_MFA_TTL_MS = 5 * 60 * 1000;

// Issued once a password has already checked out but MFA is still
// outstanding — a real session is only created after verifyTotpOrBackupCode
// succeeds against this token's userId, so a stolen/guessed pendingToken
// alone can't authenticate anything.
export async function createPendingMfaToken(userId: string): Promise<string> {
  // Opportunistic cleanup of abandoned (never-completed) pending logins —
  // cheap since this only runs once per login attempt, and keeps the table
  // from growing unbounded without a separate scheduled job.
  db.prepare("DELETE FROM pending_mfa WHERE expiresAt < ?").run(new Date().toISOString());

  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare(
    "INSERT INTO pending_mfa (tokenHash, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)",
  ).run(hashToken(token), userId, new Date(now).toISOString(), new Date(now + PENDING_MFA_TTL_MS).toISOString());
  return token;
}

// Single-use: always deletes the row, whether or not it turns out to be
// valid/expired, so a leaked pending token can't be replayed after this call.
export async function consumePendingMfaToken(token: string): Promise<string | null> {
  const row = db
    .prepare("SELECT userId, expiresAt FROM pending_mfa WHERE tokenHash = ?")
    .get(hashToken(token)) as { userId: string; expiresAt: string } | undefined;
  if (!row) return null;
  db.prepare("DELETE FROM pending_mfa WHERE tokenHash = ?").run(hashToken(token));
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;
  return row.userId;
}

export async function isTotpEnabled(userId: string): Promise<boolean> {
  const row = db.prepare("SELECT totpEnabled FROM users WHERE id = ?").get(userId) as
    | { totpEnabled: number }
    | undefined;
  return !!row?.totpEnabled;
}

// Stores the secret immediately (unconfirmed — totpEnabled stays 0) so
// confirmTotpEnrollment has something to check the user's first code
// against; starting enrollment again before confirming just overwrites it.
export async function beginTotpEnrollment(userId: string): Promise<{ secret: string; otpAuthUri: string }> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  const secret = generateTotpSecret();
  db.prepare("UPDATE users SET totpSecret = ?, totpEnabled = 0 WHERE id = ?").run(secret, userId);
  return { secret, otpAuthUri: generateOtpAuthUri(secret, user.email) };
}

function normalizeBackupCode(code: string): string {
  return code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(6).toString("hex");
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

// Requires a real code from the just-scanned secret before flipping
// totpEnabled on — otherwise a typo'd/never-actually-configured
// authenticator app would lock the account out at the very next login.
// Returns the plaintext backup codes exactly once; only their hashes are
// ever stored.
export async function confirmTotpEnrollment(userId: string, code: string): Promise<string[]> {
  const row = db.prepare("SELECT totpSecret FROM users WHERE id = ?").get(userId) as
    | { totpSecret: string | null }
    | undefined;
  if (!row?.totpSecret) throw new Error("Start enrollment before confirming a code.");
  if (!verifyTotp(row.totpSecret, code)) {
    throw new Error("That code didn't match. Check your authenticator app and try again.");
  }

  const backupCodes = generateBackupCodes();
  db.prepare("UPDATE users SET totpEnabled = 1, totpBackupCodesJson = ? WHERE id = ?").run(
    JSON.stringify(backupCodes.map(hashBackupCode)),
    userId,
  );
  return backupCodes;
}

export async function disableTotp(userId: string, currentPassword: string): Promise<boolean> {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as UserRow | undefined;
  if (!row || !passwordMatches(currentPassword, row.passwordSalt, row.passwordHash)) return false;
  db.prepare(
    "UPDATE users SET totpEnabled = 0, totpSecret = NULL, totpBackupCodesJson = NULL WHERE id = ?",
  ).run(userId);
  return true;
}

// Tries a live TOTP code first, then falls back to a backup code — each
// backup code is consumed (removed from the stored list) on successful use
// so it can't be replayed.
export async function verifyTotpOrBackupCode(userId: string, code: string): Promise<boolean> {
  const row = db.prepare("SELECT totpSecret, totpBackupCodesJson FROM users WHERE id = ?").get(userId) as
    | { totpSecret: string | null; totpBackupCodesJson: string | null }
    | undefined;
  if (!row?.totpSecret) return false;

  if (verifyTotp(row.totpSecret, code)) return true;

  const backupCodeHashes: string[] = row.totpBackupCodesJson ? JSON.parse(row.totpBackupCodesJson) : [];
  const index = backupCodeHashes.indexOf(hashBackupCode(code));
  if (index === -1) return false;

  backupCodeHashes.splice(index, 1);
  db.prepare("UPDATE users SET totpBackupCodesJson = ? WHERE id = ?").run(
    JSON.stringify(backupCodeHashes),
    userId,
  );
  return true;
}

// Convenience for Server Components/Route Handlers: reads the session
// cookie directly rather than requiring every caller to thread the token
// through from a NextRequest.
export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get("session")?.value;
  return getSessionUser(token);
}
