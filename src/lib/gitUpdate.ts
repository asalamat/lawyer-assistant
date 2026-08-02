import { execFile } from "child_process";
import { promisify } from "util";

const run = promisify(execFile);
const CWD = process.cwd();

interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  date: string;
}

interface UpdateStatus {
  branch: string;
  current: CommitInfo | null;
  latest: CommitInfo | null;
  commitsBehind: number;
  upToDate: boolean;
  error: string | null;
}

async function git(args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd: CWD });
  return stdout.trim();
}

async function getCommitInfo(ref: string): Promise<CommitInfo | null> {
  try {
    const output = await git(["log", "-1", "--format=%H|%h|%s|%ci", ref]);
    const [sha, shortSha, message, date] = output.split("|");
    return { sha, shortSha, message, date };
  } catch {
    return null;
  }
}

// Local-only, no network call — safe to use on every page render (e.g. a
// footer). getUpdateStatus() below does a `git fetch` and is only for the
// explicit "check for updates" action, not for cheap/frequent display.
export async function getCurrentCommit(): Promise<CommitInfo | null> {
  return getCommitInfo("HEAD");
}

export async function getUpdateStatus(): Promise<UpdateStatus> {
  try {
    const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
    await git(["fetch", "origin", branch, "--quiet"]);

    const current = await getCommitInfo("HEAD");
    const latest = await getCommitInfo(`origin/${branch}`);

    const behindOutput = await git([
      "rev-list",
      "--count",
      `HEAD..origin/${branch}`,
    ]);
    const commitsBehind = parseInt(behindOutput, 10) || 0;

    return {
      branch,
      current,
      latest,
      commitsBehind,
      upToDate: commitsBehind === 0,
      error: null,
    };
  } catch (err) {
    return {
      branch: "unknown",
      current: null,
      latest: null,
      commitsBehind: 0,
      upToDate: true,
      error: err instanceof Error ? err.message : "Failed to check for updates",
    };
  }
}

export async function pullLatest(): Promise<{ success: boolean; message: string }> {
  try {
    const status = await git(["status", "--porcelain"]);
    if (status) {
      return {
        success: false,
        message: "You have uncommitted local changes. Commit or discard them before pulling.",
      };
    }

    const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
    await git(["pull", "--ff-only", "origin", branch]);
    const current = await getCommitInfo("HEAD");
    return {
      success: true,
      message: `Updated to ${current?.shortSha ?? "latest"}: ${current?.message ?? ""}`,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Pull failed",
    };
  }
}
