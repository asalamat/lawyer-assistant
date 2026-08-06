import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { verifyAuditLogIntegrity, type AuditIntegrityResult } from "./auditLog";
import { listBackups, type BackupInfo } from "./backup";
import db from "./db";
import { getHealthStatus, type HealthStatus } from "./health";
import { getMasterKeyStorageBackend } from "./masterKey";
import { getAppVersion, type AppVersion } from "./systemInfo";

const DATA_DIR = path.join(process.cwd(), "data");
const BACKUPS_DIR = path.join(process.cwd(), "backups");

function dirSizeBytes(dirPath: string): number {
  if (!existsSync(dirPath)) return 0;
  let total = 0;
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else total += statSync(full).size;
    }
  }
  return total;
}

interface RowCounts {
  matters: number;
  documents: number;
  clients: number;
  users: number;
  activeSessions: number;
  drafts: number;
  chatMessages: number;
  auditLogRows: number;
  agentRuns: number;
  documentChunks: number;
}

function getRowCounts(): RowCounts {
  const count = (sql: string, ...params: (string | number)[]) =>
    (db.prepare(sql).get(...params) as { c: number }).c;
  return {
    matters: count("SELECT COUNT(*) as c FROM matters"),
    documents: count("SELECT COUNT(*) as c FROM documents"),
    clients: count("SELECT COUNT(*) as c FROM clients"),
    users: count("SELECT COUNT(*) as c FROM users WHERE active = 1"),
    activeSessions: count("SELECT COUNT(*) as c FROM sessions WHERE expiresAt > ?", new Date().toISOString()),
    drafts: count("SELECT COUNT(*) as c FROM drafts"),
    chatMessages: count("SELECT COUNT(*) as c FROM chat_messages"),
    auditLogRows: count("SELECT COUNT(*) as c FROM audit_log"),
    agentRuns: count("SELECT COUNT(*) as c FROM agent_runs"),
    documentChunks: count("SELECT COUNT(*) as c FROM document_chunks"),
  };
}

interface StorageInfo {
  databaseBytes: number;
  uploadsBytes: number;
  backupsBytes: number;
  masterKeyStorage: "keychain" | "file" | "none";
}

function getStorageInfo(): { databaseBytes: number; uploadsBytes: number; backupsBytes: number } {
  const dbPath = path.join(DATA_DIR, "app.db");
  return {
    databaseBytes: existsSync(dbPath) ? statSync(dbPath).size : 0,
    uploadsBytes: dirSizeBytes(path.join(DATA_DIR, "uploads")),
    backupsBytes: dirSizeBytes(BACKUPS_DIR),
  };
}

export interface MonitoringSnapshot {
  appVersion: AppVersion;
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  health: HealthStatus;
  auditIntegrity: AuditIntegrityResult;
  counts: RowCounts;
  storage: StorageInfo;
  backups: BackupInfo[];
  latestBackupAgeDays: number | null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// One aggregate read for the monitoring page — deliberately just reads
// (row counts, file sizes, the existing audit-integrity check), nothing
// here writes or repairs anything. Local-only, no network calls beyond
// what getHealthStatus() already does (none — it only reads configured
// keys, never calls out to a provider to test them).
export async function getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  const [appVersion, health, auditIntegrity, backups, masterKeyStorage] = await Promise.all([
    getAppVersion(),
    getHealthStatus(),
    verifyAuditLogIntegrity(),
    listBackups(),
    getMasterKeyStorageBackend(),
  ]);

  const latestBackupAgeDays =
    backups.length > 0
      ? (Date.now() - new Date(backups[0].createdAt).getTime()) / 86_400_000
      : null;

  return {
    appVersion,
    uptimeSeconds: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    health,
    auditIntegrity,
    counts: getRowCounts(),
    storage: { ...getStorageInfo(), masterKeyStorage },
    backups,
    latestBackupAgeDays,
  };
}
