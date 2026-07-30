import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { readSecureJson, writeSecureJson } from "./secureStore";

const AUTH_FILE = "auth.json";

interface AuthData {
  passwordHash?: string;
  passwordSalt?: string;
  activeSessionToken?: string;
}

async function readAuth(): Promise<AuthData> {
  return readSecureJson<AuthData>(AUTH_FILE, {});
}

async function writeAuth(data: AuthData): Promise<void> {
  await writeSecureJson(AUTH_FILE, data);
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

export async function isPasswordSet(): Promise<boolean> {
  const auth = await readAuth();
  return Boolean(auth.passwordHash);
}

export async function setPassword(password: string): Promise<void> {
  const auth = await readAuth();
  const salt = randomBytes(16).toString("hex");
  auth.passwordSalt = salt;
  auth.passwordHash = hashPassword(password, salt);
  await writeAuth(auth);
}

export async function verifyPassword(password: string): Promise<boolean> {
  const auth = await readAuth();
  if (!auth.passwordHash || !auth.passwordSalt) return false;
  const candidate = hashPassword(password, auth.passwordSalt);
  const stored = Buffer.from(auth.passwordHash, "hex");
  const candidateBuf = Buffer.from(candidate, "hex");
  if (stored.length !== candidateBuf.length) return false;
  return timingSafeEqual(stored, candidateBuf);
}

export async function createSession(): Promise<string> {
  const auth = await readAuth();
  const token = randomBytes(32).toString("hex");
  auth.activeSessionToken = token;
  await writeAuth(auth);
  return token;
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const auth = await readAuth();
  if (!auth.activeSessionToken) return false;
  const stored = Buffer.from(auth.activeSessionToken);
  const candidate = Buffer.from(token);
  if (stored.length !== candidate.length) return false;
  return timingSafeEqual(stored, candidate);
}

export async function clearSession(): Promise<void> {
  const auth = await readAuth();
  delete auth.activeSessionToken;
  await writeAuth(auth);
}
