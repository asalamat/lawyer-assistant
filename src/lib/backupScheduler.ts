import { runScheduledBackup } from "./backup";
import { getBackupScheduleStatus, recordBackupScheduleResult } from "./settings";

// Checks every 5 minutes whether an automatic backup is due, rather than
// setting a single setInterval at the configured cadence — that would need
// tearing down and recreating the interval every time the interval-hours
// setting changes in Settings. Checking against lastRunAt + intervalHours
// on a short fixed cadence picks up a changed setting on its own next tick.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const STARTUP_DELAY_MS = 30 * 1000;

let started = false;

async function tick(): Promise<void> {
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
    console.error("[backup-scheduler] automatic backup failed:", message);
  }
}

function runTick(): void {
  tick().catch((err) => console.error("[backup-scheduler] tick error:", err));
}

// Idempotent — safe to call more than once (e.g. if instrumentation's
// register() somehow runs twice in the same process); only the first call
// actually starts the interval.
export function startBackupScheduler(): void {
  if (started) return;
  started = true;
  console.log("[backup-scheduler] started — checking every 5 minutes whether an automatic backup is due");
  setInterval(runTick, CHECK_INTERVAL_MS);
  setTimeout(runTick, STARTUP_DELAY_MS);
}
