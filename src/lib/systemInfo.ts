import { statSync } from "fs";
import path from "path";
import packageJson from "../../package.json";
import db from "./db";
import { getUpdateStatus } from "./gitUpdate";

interface TableCounts {
  matters: number;
  documents: number;
  chatMessages: number;
  auditLog: number;
  matterDigests: number;
}

export interface SystemInfo {
  appVersion: string;
  nodeVersion: string;
  nextVersion: string;
  gitCommit: { shortSha: string; message: string; date: string } | null;
  db: {
    path: string;
    sizeBytes: number;
    counts: TableCounts;
  };
}

function countRows(table: string): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
    count: number;
  };
  return row.count;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const updateStatus = await getUpdateStatus();
  const dbPath = path.join(process.cwd(), "data", "app.db");

  let sizeBytes = 0;
  try {
    sizeBytes = statSync(dbPath).size;
  } catch {
    sizeBytes = 0;
  }

  return {
    appVersion: packageJson.version,
    nodeVersion: process.version,
    nextVersion: packageJson.dependencies.next,
    gitCommit: updateStatus.current
      ? {
          shortSha: updateStatus.current.shortSha,
          message: updateStatus.current.message,
          date: updateStatus.current.date,
        }
      : null,
    db: {
      path: dbPath,
      sizeBytes,
      counts: {
        matters: countRows("matters"),
        documents: countRows("documents"),
        chatMessages: countRows("chat_messages"),
        auditLog: countRows("audit_log"),
        matterDigests: countRows("matter_digests"),
      },
    },
  };
}
