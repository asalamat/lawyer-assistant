import { execFile } from "child_process";
import { randomBytes } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const KEYCHAIN_SERVICE = "LawyerAssistant";
const KEYCHAIN_ACCOUNT = "masterEncryptionKey";
// Only used on non-macOS, or if the Keychain is unavailable (e.g. a headless
// server) — kept outside data/ so it isn't backed up/copied alongside the
// encrypted data it protects.
const FALLBACK_KEY_PATH = path.join(os.homedir(), ".lawyer-assistant", "masterkey");

let cachedKey: Buffer | null = null;

async function readFromKeychain(): Promise<Buffer | null> {
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-a",
      KEYCHAIN_ACCOUNT,
      "-s",
      KEYCHAIN_SERVICE,
      "-w",
    ]);
    const hex = stdout.trim();
    return hex ? Buffer.from(hex, "hex") : null;
  } catch {
    return null;
  }
}

async function writeToKeychain(key: Buffer): Promise<boolean> {
  try {
    // -A grants all local apps read access without an interactive prompt —
    // acceptable here since this is a single-user local machine already
    // protected by FileVault; an interactive prompt would otherwise hang a
    // non-interactive process (e.g. a future cron job) forever.
    await execFileAsync("security", [
      "add-generic-password",
      "-a",
      KEYCHAIN_ACCOUNT,
      "-s",
      KEYCHAIN_SERVICE,
      "-w",
      key.toString("hex"),
      "-A",
    ]);
    return true;
  } catch {
    return false;
  }
}

async function readFallbackFile(): Promise<Buffer | null> {
  if (!existsSync(FALLBACK_KEY_PATH)) return null;
  const hex = (await readFile(FALLBACK_KEY_PATH, "utf-8")).trim();
  return hex ? Buffer.from(hex, "hex") : null;
}

async function writeFallbackFile(key: Buffer): Promise<void> {
  await mkdir(path.dirname(FALLBACK_KEY_PATH), { recursive: true });
  await writeFile(FALLBACK_KEY_PATH, key.toString("hex"), { encoding: "utf-8", mode: 0o600 });
}

async function readExistingKey(): Promise<Buffer | null> {
  if (process.platform === "darwin") {
    const fromKeychain = await readFromKeychain();
    if (fromKeychain) return fromKeychain;
  }
  return readFallbackFile();
}

// Returns the app-wide 32-byte AES-256 key used to encrypt secrets and
// documents at rest, generating and persisting one on first use. Prefers the
// macOS Keychain (a store separate from the disk holding the encrypted data)
// over a plain key file.
export async function getMasterKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;

  const existing = await readExistingKey();
  if (existing) {
    cachedKey = existing;
    return existing;
  }

  const key = randomBytes(32);
  const storedInKeychain = process.platform === "darwin" && (await writeToKeychain(key));
  if (storedInKeychain) {
    cachedKey = key;
    return key;
  }

  // Another process may have won the race to create the Keychain entry
  // first (concurrent Next.js dev workers can all hit this on a cold
  // start) — re-read before falling back to a file, so they don't end up
  // encrypting with different keys.
  const raceWinner = await readExistingKey();
  if (raceWinner) {
    cachedKey = raceWinner;
    return raceWinner;
  }

  await writeFallbackFile(key);
  cachedKey = key;
  return key;
}
