import { runScheduledBackup } from "./backup";
import {
  getBackupScheduleStatus,
  getChangeBackupStatus,
  recordBackupScheduleResult,
  recordChangeBackupResult,
} from "./settings";

// Checks every minute whether either automatic-backup mechanism is due,
// rather than setting one setInterval per configured cadence — that would
// need tearing down and recreating intervals every time a setting changes.
// A short fixed cadence just picks up any changed setting (or a pending
// change waiting out its debounce) on its own next tick. One minute keeps
// the change-triggered debounce feeling responsive without adding
// meaningful overhead (each tick is a couple of cheap settings reads).
const CHECK_INTERVAL_MS = 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;

let started = false;

// In-memory only, by design — a change worth backing up is, almost by
// definition, still sitting in the real data (the database/filesystem),
// so there's nothing to lose by not persisting this flag across a
// restart; it just means a restart looks like "quiet" until the next
// real change comes in, which is harmless.
let lastChangeAt: number | null = null;

// Called from proxy.ts on every mutating API request (see the exclusion
// list there for what doesn't count) — deliberately cheap and
// synchronous, since it runs on the hot path of every such request.
export function markDirty(): void {
  lastChangeAt = Date.now();
}

async function tickIntervalBackup(): Promise<void> {
  const status = await getBackupScheduleStatus();
  if (!status.enabled) return;

  const dueAt = status.lastRunAt
    ? new Date(status.lastRunAt).getTime() + status.intervalHours * 60 * 60 * 1000
    : 0; // never run before — due immediately once enabled
  if (Date.now() < dueAt) return;

  try {
    await runScheduledBackup("interval");
    await recordBackupScheduleResult("ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automatic backup failed";
    await recordBackupScheduleResult("error", message);
    console.error("[backup-scheduler] interval backup failed:", message);
  }
}

async function tickChangeBackup(): Promise<void> {
  const status = await getChangeBackupStatus();
  if (!status.enabled) return;
  if (lastChangeAt === null) return; // nothing's changed since the app started (or since the last backup)

  const quietForMs = Date.now() - lastChangeAt;
  if (quietForMs < status.debounceMinutes * 60 * 1000) return; // still actively changing — wait for it to settle

  const sinceLastBackupMs = status.lastRunAt ? Date.now() - new Date(status.lastRunAt).getTime() : Infinity;
  if (sinceLastBackupMs < status.cooldownMinutes * 60 * 1000) return; // too soon since the last one — try again next tick

  // Clear the flag now, right before actually backing up — a change that
  // arrives *during* the backup itself will set it again and get its own
  // later backup, rather than being silently absorbed into this one.
  lastChangeAt = null;
  try {
    await runScheduledBackup("change");
    await recordChangeBackupResult("ok");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automatic backup failed";
    await recordChangeBackupResult("error", message);
    console.error("[backup-scheduler] change-triggered backup failed:", message);
  }
}

function runTick(): void {
  tickIntervalBackup().catch((err) => console.error("[backup-scheduler] interval tick error:", err));
  tickChangeBackup().catch((err) => console.error("[backup-scheduler] change tick error:", err));
}

// Idempotent — safe to call more than once (e.g. if instrumentation's
// register() somehow runs twice in the same process); only the first call
// actually starts the interval.
export function startBackupScheduler(): void {
  if (started) return;
  started = true;
  console.log("[backup-scheduler] started — checking every minute whether an automatic backup is due");
  setInterval(runTick, CHECK_INTERVAL_MS);
  setTimeout(runTick, STARTUP_DELAY_MS);
}
