import packageJson from "../../package.json";
import { getCurrentCommit } from "./gitUpdate";

export interface AppVersion {
  appVersion: string;
  gitCommit: { shortSha: string; message: string; date: string } | null;
}

// Local-only (no network fetch) — safe to call on every page render.
export async function getAppVersion(): Promise<AppVersion> {
  const commit = await getCurrentCommit();
  return {
    appVersion: packageJson.version,
    gitCommit: commit
      ? { shortSha: commit.shortSha, message: commit.message, date: commit.date }
      : null,
  };
}
