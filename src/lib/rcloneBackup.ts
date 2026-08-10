import { execFile } from "child_process";
import { promisify } from "util";
import type { RcloneBackupConfig } from "./settings";

const execFileAsync = promisify(execFile);

interface ExecFileError extends Error {
  code?: string | number;
  stderr?: string;
}

// rclone never sees a request from this app for anything except the local
// backup file's path — the actual Microsoft/Google/S3/whatever credentials
// for the remote live entirely in rclone's own config file
// (~/.config/rclone/rclone.conf by default), set up once via `rclone
// config` in a terminal. This app only ever shells out to the binary.
function binary(config: RcloneBackupConfig): string {
  return config.binaryPath || "rclone";
}

function remotePath(config: RcloneBackupConfig, fileName?: string): string {
  const base = config.path ? config.path.replace(/^\/+|\/+$/g, "") : "";
  const remote = `${config.remote}:${base}`;
  return fileName ? `${remote}/${fileName}` : remote;
}

function formatRcloneError(err: unknown): string {
  const e = err as ExecFileError;
  if (e?.code === "ENOENT") {
    return "rclone isn't installed (or isn't on PATH) — install it (e.g. `brew install rclone` on macOS) or set a custom binary path in Settings.";
  }
  if (typeof e?.stderr === "string" && e.stderr.trim()) {
    // rclone's stderr is often several lines of INFO/NOTICE logging; the
    // actual failure reason is reliably the last non-empty line.
    const lines = e.stderr.trim().split("\n").filter(Boolean);
    return lines[lines.length - 1];
  }
  return err instanceof Error ? err.message : "rclone command failed";
}

export async function uploadViaRclone(config: RcloneBackupConfig, filePath: string, fileName: string): Promise<void> {
  try {
    await execFileAsync(binary(config), ["copyto", filePath, remotePath(config, fileName)], {
      timeout: 10 * 60 * 1000,
    });
  } catch (err) {
    throw new Error(formatRcloneError(err));
  }
}

// Lists the remote's target folder rather than writing a throwaway test
// file — good enough to prove the remote is configured and reachable, and
// doesn't leave clutter behind the way the S3 test does (rclone remotes
// are more often a personal account than a dedicated backup bucket, so
// being tidy matters more here).
export async function testRcloneConnection(config: RcloneBackupConfig): Promise<void> {
  try {
    await execFileAsync(binary(config), ["lsd", remotePath(config)], { timeout: 30_000 });
  } catch (err) {
    throw new Error(formatRcloneError(err));
  }
}

interface RcloneLsJsonEntry {
  Name: string;
  ModTime: string;
}

// Mirrors pruneOldBackups()/pruneCloudBackups() elsewhere — same
// MAX_BACKUPS ceiling, applied independently against whatever's actually
// on the remote.
export async function pruneRcloneBackups(config: RcloneBackupConfig, keep: number): Promise<void> {
  let stdout: string;
  try {
    const result = await execFileAsync(binary(config), ["lsjson", remotePath(config)], { timeout: 60_000 });
    stdout = result.stdout;
  } catch (err) {
    throw new Error(formatRcloneError(err));
  }

  const entries: RcloneLsJsonEntry[] = JSON.parse(stdout);
  const backups = entries
    .filter((e) => e.Name.endsWith(".tar.gz"))
    .sort((a, b) => new Date(b.ModTime).getTime() - new Date(a.ModTime).getTime());

  for (const entry of backups.slice(keep)) {
    await execFileAsync(binary(config), ["deletefile", remotePath(config, entry.Name)], {
      timeout: 60_000,
    }).catch(() => {
      // Best-effort — a stale/already-deleted remote file isn't worth failing the whole prune over.
    });
  }
}

// Lets the Settings UI offer a dropdown of remotes already set up via
// `rclone config`, instead of asking someone to type the exact name
// correctly from memory. Returns an empty list (not an error) if rclone
// isn't installed yet or nothing's configured — the UI falls back to a
// plain text field either way.
export async function listRcloneRemotes(binaryPath?: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(binaryPath || "rclone", ["listremotes"], { timeout: 10_000 });
    return stdout
      .split("\n")
      .map((line) => line.trim().replace(/:$/, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}
