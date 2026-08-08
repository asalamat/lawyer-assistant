import { recordAuditEvent } from "./auditLog";

// DLP-lite: not a real data-loss-prevention system (no content inspection,
// no network egress control) — just the two things that matter most for a
// firm this size without one. Bulk/export-shaped actions (backup
// downloads, emailing several documents out, a client pulling many shared
// files) are rate-limited per actor, and crossing a lower "this is worth a
// human looking at" threshold writes a distinctly-labelled audit event
// rather than blending in with routine single-document activity.
//
// In-memory, per-process — resets on restart and doesn't share state across
// instances, the same tradeoff the existing login rate limiter (rateLimit.ts)
// already makes for this app's single-server deployment model.

interface WindowState {
  count: number;
  windowStartedAt: number;
}

const WINDOW_MS = 60 * 60 * 1000;
const stateByKey = new Map<string, WindowState>();

function windowKey(action: string, actorKey: string): string {
  return `${action}:${actorKey}`;
}

function recordOne(key: string): number {
  const now = Date.now();
  const state = stateByKey.get(key);
  if (!state || now - state.windowStartedAt > WINDOW_MS) {
    stateByKey.set(key, { count: 1, windowStartedAt: now });
    return 1;
  }
  state.count += 1;
  return state.count;
}

export interface ExportGuardConfig {
  action: string;
  // Blocked once the actor's rolling-hour count exceeds this.
  hardLimit: number;
  // An audit event is written the moment the count reaches this — set
  // below hardLimit so the alert lands before the actor gets blocked, not
  // as a byproduct of it.
  alertThreshold: number;
}

// Call after authorizing the request but before doing the actual export —
// records this attempt against the actor's rolling-hour window and reports
// whether it's still within the hard limit. matterId is optional context
// for the audit trail, not part of the rate-limit key (an actor exporting
// across many different matters is exactly the pattern this exists to
// catch, not something to reset the counter for).
export async function checkExportGuard(
  config: ExportGuardConfig,
  actorKey: string,
  actorLabel: string,
  matterId: string | null = null,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const key = windowKey(config.action, actorKey);
  const count = recordOne(key);

  if (count === config.alertThreshold) {
    await recordAuditEvent(
      "dlp_bulk_export_alert",
      matterId,
      `${actorLabel} triggered ${count} "${config.action}" exports/downloads within an hour`,
    );
  }

  if (count > config.hardLimit) {
    return { allowed: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
