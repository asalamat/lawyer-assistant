import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type RcloneWizardProvider = "onedrive" | "google-drive";

const BACKEND_TYPE: Record<RcloneWizardProvider, string> = {
  onedrive: "onedrive",
  "google-drive": "drive",
};

interface RcloneOptionExample {
  Value: string;
  Help: string;
}

interface RcloneOption {
  Name: string;
  Help: string;
  Default: unknown;
  Examples?: RcloneOptionExample[];
  Type: string;
}

interface RcloneConfigResponse {
  State: string;
  Option?: RcloneOption;
  Error: string;
}

export type WizardState =
  | { phase: "idle" }
  | { phase: "running" }
  | {
      phase: "question";
      question: { name: string; help: string; options: { value: string; label: string }[] };
    }
  | { phase: "done"; remote: string }
  | { phase: "error"; message: string };

// Module-level, single-flight — same rationale as rcloneInstall.ts's
// status tracker: one persistent process, one wizard run at a time.
let wizardState: WizardState = { phase: "idle" };
let pendingRemoteName = "";
let pendingProvider: RcloneWizardProvider | null = null;
let pendingRcloneState = "";

export function getWizardState(): WizardState {
  return wizardState;
}

export function resetWizard(): void {
  wizardState = { phase: "idle" };
  pendingRemoteName = "";
  pendingProvider = null;
  pendingRcloneState = "";
}

function parseResponse(stdout: string): RcloneConfigResponse {
  // The very first run against a machine with no rclone.conf yet prints a
  // "Config file not found - using defaults" NOTICE line before the JSON —
  // the real payload is always the last brace-balanced block, so find the
  // first `{` rather than assume stdout is pure JSON.
  const jsonStart = stdout.indexOf("{");
  if (jsonStart === -1) throw new Error(`Unexpected rclone output: ${stdout.slice(0, 200)}`);
  return JSON.parse(stdout.slice(jsonStart));
}

async function runRcloneConfig(args: string[]): Promise<RcloneConfigResponse> {
  const { stdout } = await execFileAsync("rclone", ["config", ...args, "--non-interactive"], {
    // Generous timeout — this call can be the one that opens a browser and
    // waits for a real human to sign in and approve MFA, not a quick op.
    timeout: 5 * 60 * 1000,
    maxBuffer: 1024 * 1024,
  });
  return parseResponse(stdout);
}

// Auto-answers only the specific questions this wizard is built to expect
// for the onedrive/drive backends — always use the browser flow, and
// default OneDrive's account-type picker to "personal" (the Hotmail/
// Outlook.com case this wizard targets).
//
// Deliberately an explicit allowlist of exact question names verified
// live against a real account, NOT a generic "match anything with
// 'personal' in it" heuristic — that broader version picked the WRONG
// drive on a real account that had several Microsoft-managed storage
// resources ("Bundles", "ODCMetadataArchive", etc.) all *also* labelled
// "(personal)" alongside the actual OneDrive, silently configuring the
// remote against a metadata store no one meant to back up into. A
// question this doesn't recognize (like the drive picker, config_driveid)
// is always safer to surface to the user than to guess at, especially
// when the choice is a specific resource rather than a yes/no default.
const KNOWN_AUTO_ANSWERS: Record<string, string> = {
  config_is_local: "true",
  // OneDrive's own connection-type sub-choice (not the top-level backend
  // type, which the wizard already fixed by calling `rclone config create
  // <name> onedrive`) — "onedrive" here means "OneDrive Personal or
  // Business", as opposed to a SharePoint site/URL/search/raw-ID option.
  config_type: "onedrive",
};

function autoAnswer(option: RcloneOption): string | null {
  return KNOWN_AUTO_ANSWERS[option.Name] ?? null;
}

async function advance(remoteName: string, provider: RcloneWizardProvider, args: string[]): Promise<void> {
  let response: RcloneConfigResponse;
  try {
    response = await runRcloneConfig(args);
  } catch (err) {
    wizardState = { phase: "error", message: err instanceof Error ? err.message : "rclone command failed" };
    return;
  }

  if (response.Error) {
    wizardState = { phase: "error", message: response.Error };
    return;
  }
  if (!response.State || !response.Option) {
    wizardState = { phase: "done", remote: remoteName };
    return;
  }

  pendingRcloneState = response.State;
  const auto = autoAnswer(response.Option);
  if (auto !== null) {
    wizardState = { phase: "running" };
    await advance(remoteName, provider, ["update", remoteName, "--continue", "--state", pendingRcloneState, "--result", auto]);
    return;
  }

  wizardState = {
    phase: "question",
    question: {
      name: response.Option.Name,
      help: response.Option.Help,
      options: (response.Option.Examples ?? []).map((e) => ({ value: e.Value, label: e.Help })),
    },
  };
}

export function startWizard(provider: RcloneWizardProvider, remoteName: string): void {
  if (wizardState.phase === "running") return;
  pendingRemoteName = remoteName;
  pendingProvider = provider;
  wizardState = { phase: "running" };

  // Delete-then-create rather than erroring on "already exists" — this
  // wizard is the only thing that should be creating remotes named this
  // way, so a retry (e.g. after picking the wrong drive type) should just
  // start clean.
  execFileAsync("rclone", ["config", "delete", remoteName], { timeout: 10_000 })
    .catch(() => {
      // No pre-existing remote to delete — not an error.
    })
    .then(() => advance(remoteName, provider, ["create", remoteName, BACKEND_TYPE[provider]]))
    .catch((err) => {
      wizardState = { phase: "error", message: err instanceof Error ? err.message : "Wizard failed" };
    });
}

export function answerWizard(value: string): void {
  if (!pendingProvider || wizardState.phase !== "question") return;
  wizardState = { phase: "running" };
  advance(pendingRemoteName, pendingProvider, [
    "update",
    pendingRemoteName,
    "--continue",
    "--state",
    pendingRcloneState,
    "--result",
    value,
  ]).catch((err) => {
    wizardState = { phase: "error", message: err instanceof Error ? err.message : "Wizard failed" };
  });
}
