import { exec, execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export async function isRcloneInstalled(binaryPath?: string): Promise<boolean> {
  try {
    await execFileAsync(binaryPath || "rclone", ["version"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", [cmd], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export interface InstallPlan {
  canAutoInstall: boolean;
  command: string;
  manualUrl: string;
  reason?: string;
}

// Only offers auto-install through a package manager that's already on
// this machine (Homebrew on macOS/Linux, winget on Windows) — never
// downloads/runs an arbitrary installer script ourselves. If neither is
// present, the honest answer is "can't auto-install here", not a silent
// fallback to something riskier.
export async function getInstallPlan(): Promise<InstallPlan> {
  const manualUrl = "https://rclone.org/downloads/";

  if (process.platform === "darwin" || process.platform === "linux") {
    if (await commandExists("brew")) {
      return { canAutoInstall: true, command: "brew install rclone", manualUrl };
    }
    return {
      canAutoInstall: false,
      command: "",
      manualUrl,
      reason: "Homebrew isn't installed on this machine.",
    };
  }

  if (process.platform === "win32") {
    if (await commandExists("winget")) {
      return {
        canAutoInstall: true,
        command: "winget install -e --id Rclone.Rclone --accept-source-agreements --accept-package-agreements",
        manualUrl,
      };
    }
    return {
      canAutoInstall: false,
      command: "",
      manualUrl,
      reason: "winget isn't available on this machine.",
    };
  }

  return { canAutoInstall: false, command: "", manualUrl, reason: "Automatic install isn't supported on this platform." };
}

export interface InstallStatus {
  state: "idle" | "running" | "success" | "error";
  log: string;
}

// Module-level, in-memory, single-flight — this app runs as one persistent
// process, and an install only ever needs to happen once per machine, so
// there's no need to persist this across a restart.
let currentStatus: InstallStatus = { state: "idle", log: "" };

export function getInstallStatus(): InstallStatus {
  return currentStatus;
}

// Fires the install and returns immediately — brew/winget installs can
// take a minute or more (a real bottle download, not instant), so the
// caller polls getInstallStatus() rather than this blocking a request.
export async function startRcloneInstall(): Promise<InstallStatus> {
  if (currentStatus.state === "running") return currentStatus;

  const plan = await getInstallPlan();
  if (!plan.canAutoInstall) {
    currentStatus = { state: "error", log: plan.reason || "Automatic install isn't available on this machine." };
    return currentStatus;
  }

  currentStatus = { state: "running", log: `Running: ${plan.command}` };
  execAsync(plan.command, { timeout: 5 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 })
    .then(({ stdout }) => {
      currentStatus = { state: "success", log: stdout.slice(-2000) };
    })
    .catch((err: { stderr?: string; message?: string }) => {
      currentStatus = { state: "error", log: (err.stderr || err.message || "Install failed").slice(-2000) };
    });

  return currentStatus;
}
