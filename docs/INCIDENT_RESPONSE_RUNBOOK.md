# Incident Response Runbook

**System:** Lawyer Assistant (this repository)
**Last updated:** 2026-08-07
**Audience:** whoever is operating/administering this app when something goes
wrong — assume that's the system owner unless the firm grows enough to have a
dedicated IT/security contact.

This is a small-firm runbook for a single-server, self-hosted application —
not an enterprise incident-response plan. It's written to actually be followed
under stress: concrete commands and file paths from this specific codebase, not
generic advice. Companion document: [`PRIVACY_IMPACT_ASSESSMENT.md`](./PRIVACY_IMPACT_ASSESSMENT.md)
for what data exists and where.

## 0. Before an incident: know these things now

- **Where the app runs and who has shell/filesystem access to that machine.**
- **Where backups live:** `data/backups/*.tar.gz` on the same machine, plus
  wherever an admin has separately copied a downloaded backup to (Settings >
  Backup > download).
- **Where the master encryption key lives:** macOS Keychain (service
  `LawyerAssistant`, account `masterEncryptionKey`) or, as a fallback,
  `~/.lawyer-assistant/masterkey` on the host — **outside** `data/`, so it is
  **not** included in a `data/` backup archive. Losing this file/Keychain entry
  with no other copy means every encrypted document and backup becomes
  permanently unreadable. If there is no separate, secure copy of this key
  somewhere today, make one before you need this runbook.
- **Who the admin users are:** `Settings > Users`, or query directly:
  `sqlite3 data/app.db "SELECT email, role, active FROM users;"`
- **How to reach the account owner** if you are not them.

## 1. First 15 minutes of any suspected incident

1. **Don't panic-delete anything.** In particular, never run `DELETE FROM
   audit_log` directly — it breaks the tamper-evident hash chain for every row
   after the deletion (see `src/lib/auditLog.ts`). If audit rows genuinely need
   to be removed as part of remediation, use the sanctioned repair path in §6.
2. **Write down what you know right now**, with timestamps: what was observed,
   who reported it, what's still running. You will not remember details
   accurately in an hour.
3. **Decide whether to take the app offline.** Stopping the Next.js
   process/server stops all further access immediately (both legitimate and
   malicious) at the cost of downtime for staff/clients. For anything involving
   a suspected active intruder or ongoing data exfiltration, prefer offline
   first, investigate second.
4. **Preserve evidence before you fix anything**, where feasible: copy
   `data/app.db`, `data/backups/`, and any relevant server/access logs to a
   separate location before making changes. You cannot un-modify evidence.

## 2. Incident: suspected account compromise (staff or client portal)

**Signs:** unexpected login location/time, unexplained password reset,
unfamiliar audit log activity attributed to a real user, a user reporting they
didn't do something the audit log says they did.

1. **Immediately invalidate the account's sessions:**
   - Staff account: `Settings > Users` → reset that user's password (this also
     invalidates all their existing sessions — see `invalidateUserSessions()`
     in `src/lib/auth.ts`), or deactivate the account outright if compromise is
     confirmed rather than suspected.
   - Client portal account: from the client's detail page, use "Reset password"
     under Client portal access — this rotates the password and invalidates
     existing client sessions (`invalidateClientUserSessions()` in
     `src/lib/clientAuth.ts`).
2. **Review the audit log for that user/account** (`/audit`, filterable) —
   reconstruct exactly what they accessed or changed while potentially
   compromised. Look specifically for the DLP-lite alert action
   `dlp_bulk_export_alert` and any `*_downloaded`/`matter_email_sent` entries —
   these are the actions most likely to indicate actual data exfiltration
   rather than just access.
3. **Check whether MFA was enabled** on the account — MFA status is
   self-service only (`Settings > Security` shows it for whoever is currently
   logged in, not an admin-viewable list of other users), so either ask the
   affected user directly or query it: `sqlite3 data/app.db "SELECT email,
   totpEnabled FROM users WHERE id = '<userId>';"`. If it was off, and this is
   a staff account, have that person enable it now as part of remediation, not
   just as a general firm-wide follow-up.
4. **If the account had portal or matter-team access to sensitive matters**,
   determine which matters and documents were exposed, and move to §4 (data
   exposure) for those specifically.
5. **Notify the account owner and affected staff.** If client data was
   plausibly exposed, this becomes a client-notification decision — see §5.

## 3. Incident: malware detected

**Signs:** ClamAV quarantines an uploaded file (`malware_detected` audit event,
a "quarantined — malware detected" badge on a document), or a report of
unexpected file behaviour from a staff member's machine after downloading
something from the app.

1. **Confirm quarantine actually happened.** A quarantined file is moved to
   `data/quarantine/<matterId>/` or `data/quarantine/reference-library/`
   (`src/lib/malwareScan.ts`) rather than the normal uploads path, and is never
   chunked, text-extracted, or served as "chat-readable" — verify the file in
   question is actually there and not in the normal `data/uploads/` path.
2. **Identify who uploaded it and when** via the audit log entry's detail
   (includes the ClamAV signature name) and the document's `uploadedAt`.
3. **If ClamAV did NOT catch it** (e.g. a staff member's own machine got
   infected from a downloaded document, or ClamAV's signatures were stale) —
   this is a client-side incident on that person's machine, not this
   application's data. Isolate that machine per normal IT practice; separately
   verify `Settings > Privacy` shows ClamAV is actually installed and its
   signatures are current (`isMalwareScanningAvailable()`), since a
   silently-broken scanner would explain documents passing through unscanned.
4. **Do not "un-quarantine" a file to see what it does.** If forensic
   examination is needed, do it on an isolated machine, not the production
   server.
5. **Delete the quarantined file** once the incident is closed and no longer
   needed as evidence (there is currently no UI for this — it's a direct
   filesystem deletion of the quarantine path).

## 4. Incident: unauthorized data exposure/access

**Signs:** a document or matter was visible to someone who shouldn't have had
access — a client portal account seeing another client's matter, an ethical
wall not actually blocking someone, a `dlp_bulk_export_alert` for an unexplained
bulk download, a misconfigured "Share with client" toggle exposing the wrong
document.

1. **Scope it precisely.** For each exposed item, determine: what was exposed,
   to whom, for how long, and whether it was actually viewed/downloaded (not
   just accessible) — the audit log (`document_shared_with_client`,
   `client_portal_document_downloaded`, `matter_email_sent`, etc.) is the
   primary source of truth for "was it actually accessed," not just "could it
   have been."
2. **Cut off further exposure immediately:**
   - Wrong document shared with a client: toggle "Share with client" off for
     that document on the matter's Overview page.
   - Ethical wall not enforcing correctly: verify `matter.ethicalWall` is
     actually set and that `canAccessMatter()` (`src/lib/matterAccess.ts`) is
     being hit — check `src/proxy.ts` is actually running (not bypassed by a
     reverse-proxy misconfiguration in front of it, if one exists).
   - Client portal cross-client access: this would indicate a bug in the
     `matter.clientId === clientUser.clientId` check
     (`src/app/api/portal/matters/[id]/documents/[docId]/route.ts` and
     `src/app/portal/matters/[id]/page.tsx`) — treat as a code-level
     vulnerability, not just a configuration mistake, and stop granting new
     portal access until it's confirmed fixed.
3. **Determine if this rises to a reportable privacy breach** under the firm's
   professional obligations (law society rules) and applicable privacy
   legislation (PIPEDA and/or provincial equivalent) — this is a legal/ethics
   judgment call for the account owner or the firm's own counsel, not something
   this runbook can decide. When in doubt, treat exposure of actual client
   matter content (not just metadata) as reportable and get that judgment made
   quickly rather than defaulting to "probably fine."
4. **Document the exposure and the fix** — this document doesn't specify a
   notification template because that depends on the applicable legal
   requirements at the time, which this runbook doesn't track.

## 5. Client notification

If a decision is made to notify affected clients (per §4.3), at minimum
communicate: what happened, what data was involved, when it happened, when it
was discovered, what's been done to contain it, and what the client should do
(if anything) — the actual legal notification requirements and timelines
depend on which privacy legislation applies and are outside what this document
can specify. Get that answer from the firm's own counsel or the account owner
before sending anything.

## 6. Restoring the audit log after a legitimate row deletion

If, during remediation, audit rows genuinely need to be removed (e.g. rows
belonging to a test/throwaway account, or rows that themselves contain data
that must be purged), the hash chain will break for every row after the
deletion point. Fix it properly rather than leaving it broken or, worse,
manually recomputing hashes by hand:

1. Confirm the break: `GET /api/audit/verify` (admin session) — returns
   `{ valid: false, brokenAtId: "..." }`.
2. Re-anchor with an honest, specific reason: `POST /api/audit/reanchor` with
   `{ "reason": "..." }` — this recomputes every row's hash from genesis over
   whatever rows currently exist and writes a permanent, visible
   `audit_chain_reanchored` event containing your stated reason
   (`reanchorAuditLogIntegrity()` in `src/lib/auditLog.ts`).
3. Confirm the fix: `GET /api/audit/verify` again should return `valid: true`.
4. **Only ever do this when the cause of the break is fully known and
   legitimate.** Re-anchoring over unexplained chain breakage (as opposed to a
   deletion you deliberately performed and can name) would erase the evidence
   of possible tampering — investigate first, re-anchor second.

## 7. Restoring from backup

1. List available backups: `Settings > Backup`, or
   `sqlite3`-adjacent inspection of `data/backups/*.tar.gz` on the host.
2. **Before restoring, confirm the master encryption key currently available
   on the host is the same one that encrypted the backup's documents** (see
   §0) — restoring a backup onto a machine with a *different* master key
   produces a data directory full of documents that will fail to decrypt.
3. Restore via `Settings > Backup > Restore` (`src/app/api/backup/restore/route.ts`)
   or the equivalent `restoreBackup()` call — this requires an app restart
   afterward (the running process has the old SQLite file open).
4. After restoring, run `GET /api/audit/verify` to confirm the restored audit
   log's hash chain is intact, and spot-check a handful of documents open
   correctly (decrypt successfully) before considering the restore complete.

## 8. Post-incident

- Add a dated entry to this runbook or `docs/ROADMAP.md` describing what
  happened and what changed as a result — this runbook is only useful if it
  reflects real incidents and their fixes, not just the day it was written.
- If the incident revealed a gap in the [Privacy Impact
  Assessment](./PRIVACY_IMPACT_ASSESSMENT.md)'s §8 (known gaps), update that
  document too.
- If the incident involved a code-level vulnerability (not just
  misconfiguration or a compromised credential), fix it, and consider whether
  it warrants the "independent security audit" flagged as a gap in the PIA.
