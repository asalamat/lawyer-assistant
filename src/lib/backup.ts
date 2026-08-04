import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "fs";
import path from "path";
import { create, extract } from "tar";
import db from "./db";

const PROJECT_ROOT = process.cwd();
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const BACKUPS_DIR = path.join(PROJECT_ROOT, "backups");
const MAX_BACKUPS = 10;

function ensureBackupsDir(): void {
  if (!existsSync(BACKUPS_DIR)) mkdirSync(BACKUPS_DIR, { recursive: true });
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export interface BackupInfo {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export async function listBackups(): Promise<BackupInfo[]> {
  ensureBackupsDir();
  return readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith(".tar.gz"))
    .map((fileName) => {
      const stat = statSync(path.join(BACKUPS_DIR, fileName));
      return { fileName, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function pruneOldBackups(keep = MAX_BACKUPS): void {
  const files = readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith(".tar.gz"))
    .map((f) => ({ f, birthtime: statSync(path.join(BACKUPS_DIR, f)).birthtime.getTime() }))
    .sort((a, b) => b.birthtime - a.birthtime);
  for (const { f } of files.slice(keep)) {
    rmSync(path.join(BACKUPS_DIR, f), { force: true });
  }
}

// Snapshots data/ into a single .tar.gz under backups/. The SQLite file is
// handled specially — VACUUM INTO produces a consistent single-file
// snapshot regardless of WAL state, safer than tarring app.db directly
// while it could be mid-write. Everything else in data/ is copied as-is.
export async function createBackup(): Promise<BackupInfo> {
  ensureBackupsDir();
  const slug = timestampSlug();
  const fileName = `backup-${slug}.tar.gz`;
  const archivePath = path.join(BACKUPS_DIR, fileName);
  const stagingDir = path.join(BACKUPS_DIR, `.staging-${slug}`);
  const stagingDataDir = path.join(stagingDir, "data");

  try {
    mkdirSync(stagingDataDir, { recursive: true });
    db.exec(`VACUUM INTO '${path.join(stagingDataDir, "app.db")}'`);

    for (const entry of readdirSync(DATA_DIR)) {
      if (entry.startsWith("app.db")) continue;
      cpSync(path.join(DATA_DIR, entry), path.join(stagingDataDir, entry), { recursive: true });
    }

    await create({ gzip: true, file: archivePath, cwd: stagingDir }, ["data"]);
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }

  pruneOldBackups();

  const stat = statSync(archivePath);
  return { fileName, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() };
}

function assertSafeFileName(fileName: string): void {
  if (
    !fileName.endsWith(".tar.gz") ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("..")
  ) {
    throw new Error("Invalid backup filename");
  }
}

export function getBackupPath(fileName: string): string {
  assertSafeFileName(fileName);
  const fullPath = path.join(BACKUPS_DIR, fileName);
  if (!existsSync(fullPath)) throw new Error("Backup not found");
  return fullPath;
}

export function deleteBackup(fileName: string): void {
  const fullPath = getBackupPath(fileName);
  rmSync(fullPath, { force: true });
}

// Moves the CURRENT data/ directory aside (never deletes it) and replaces
// it with the archive's contents. The running process already has app.db
// open and the encryption master key cached — neither picks up a
// filesystem swap underneath it safely, so this requires an app restart
// immediately after to take effect. Callers must surface that clearly.
export async function restoreBackup(archivePath: string): Promise<{ movedAsideTo: string }> {
  const slug = timestampSlug();
  const extractDir = path.join(BACKUPS_DIR, `.restore-${slug}`);
  mkdirSync(extractDir, { recursive: true });

  try {
    await extract({ file: archivePath, cwd: extractDir });
    const extractedDataDir = path.join(extractDir, "data");
    if (!existsSync(extractedDataDir)) {
      throw new Error("This archive doesn't look like a valid backup (no data/ folder inside it).");
    }

    const movedAsideTo = path.join(PROJECT_ROOT, `data.before-restore-${slug}`);
    renameSync(DATA_DIR, movedAsideTo);
    renameSync(extractedDataDir, DATA_DIR);
    return { movedAsideTo };
  } finally {
    rmSync(extractDir, { recursive: true, force: true });
  }
}
