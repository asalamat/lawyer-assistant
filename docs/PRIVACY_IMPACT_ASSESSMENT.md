# Privacy Impact Assessment

**System:** Lawyer Assistant (this repository)
**Assessment date:** 2026-08-07
**Prepared by:** Ali Salamat (system owner), with implementation detail verified
directly against the current codebase (commit `29e9779` at time of writing)
**Review trigger:** re-review this document whenever a new third-party
integration is added (new AI provider, new OAuth app, new external API), whenever
the deployment moves off the current single local machine, or annually otherwise.

This is a self-assessment for a small-firm internal tool, not a
regulator-facing PIPEDA/PIPA filing — it exists so the firm has an honest,
current record of what personal information this system touches, where it goes,
and what protects it, and so that record doesn't just live in one person's head.

## 1. What this system is

A single-firm legal-matter management application: client/matter records,
document intake and storage, AI-assisted drafting and analysis (chat, digests,
evidence matrices, contradiction/Crown-position analysis, drafts), a client
portal, and supporting workflows (billing, e-signature, intake forms, email
import). Runs on infrastructure the firm controls (see §6) — there is no SaaS
vendor hosting this data.

## 2. Personal information collected and why

| Category | Examples in this system | Source | Why it's needed |
|---|---|---|---|
| Client identity | Name, email, phone, corporate/institutional contact & registration number (`clients` table) | Lawyer input, intake forms | Matter administration, billing, correspondence |
| Matter content | Uploaded documents, chat transcripts, extracted text, evidence, party details, notes | Client/lawyer upload, email import | The actual legal work — this is the core purpose of the system |
| Staff identity | Name, email, hashed password, TOTP secret (if MFA enabled), role | Admin-created accounts | Access control, audit attribution |
| Client portal identity | Email, hashed password, one account per client (`client_users` table) | Lawyer-granted portal access | Lets a client log back in and view documents shared with them, rather than a single-use link per document |
| Time/billing | Time entries, hourly rates, invoices | Staff input | Client billing |
| Signable documents / consent | Signature status, IP/timestamp of signing (`signable_documents`) | Client action via signing link | Executing engagement letters, consents |
| Audit trail | Who did what, when, on which matter (`audit_log`, hash-chained) | Automatic, every state-changing action | Accountability, tamper-evidence, professional-conduct/malpractice defence |
| Email account tokens | OAuth access tokens or IMAP app passwords for connected mail accounts (`email_accounts`) | Staff-initiated connection in Settings > Integrations | Reading/importing email into matters |

Sensitive identifiers embedded *inside* uploaded documents (SINs, SSNs, credit
card numbers, and optionally phone numbers/email addresses if a client's own
documents contain them) are detected and redacted before any AI call — see §4.
They are **not** redacted from the stored document itself; the original document
is the client's own record and redacting it in storage would corrupt evidence.

## 3. Where personal information is stored

- **Primary store:** a single SQLite database (`data/app.db`, `node:sqlite`) on
  the machine the app runs on. All tables above live here.
- **Document files:** on the same machine's filesystem (`data/uploads/`,
  `data/reference-uploads/`), **encrypted at rest** — see §5.
- **Backups:** `data/backups/*.tar.gz`, a full snapshot of the `data/` directory
  (documents remain encrypted inside the archive — see §5), created on demand or
  via a scheduled job, downloadable only by an admin.
- **No cloud database, no managed storage bucket, no SaaS vendor holds a copy**
  of this data by default. The only things that leave the machine are described
  in §4.

## 4. Where personal information leaves the system, and to whom

This is the section that actually matters for a privacy assessment — collection
and local storage are the easy part.

| Destination | What's sent | When | Safeguard |
|---|---|---|---|
| AI providers (Anthropic, OpenAI, Google Gemini, or a locally-run Ollama model) | Matter document text, chat questions, content being drafted/analyzed | Every AI-assisted feature (chat, digest, drafting, evidence matrix, etc.) | PII masking (`src/lib/piiMask.ts`) strips SIN/SSN/credit-card numbers (Luhn-checksum validated, not just format-matched) before the call; phone/email masking is admin-toggleable per identifier in Settings > Privacy. **Ollama runs locally and sends nothing externally** — the only fully non-external option. Anthropic/OpenAI/Gemini are all bound by their own commercial data-use terms, not this app's control; review those terms against the firm's confidentiality obligations before enabling a given provider for privileged/highly-sensitive matters (see the matter classification field, which exists but does not currently *block* AI use on privileged matters — see §8, item 2). |
| CanLII | Case citation lookups (public case law, not client data) | Case-noteup / legal research features | No client personal information sent — this is a legal-research API, not a document-upload API |
| SMTP server (firm's own mail server credentials, configured by admin) | Outgoing emails and any attached matter documents, sent to whatever address the sending lawyer specifies | Matter > Email tab, invoice emailing | Sending is deliberate and staff-initiated per email; DLP-lite rate limiting and audit logging apply to bulk attachment sends (see §7 and `src/lib/exportGuard.ts`) |
| Gmail / Microsoft Graph / Yahoo IMAP (client-connected mail accounts) | Nothing sent *to* them beyond OAuth/IMAP auth — matter emails are *read from* these accounts and imported in | When staff connects an account and imports/searches email | OAuth tokens (or, for Yahoo, an app password) stored in `email_accounts`, never sent to the client browser |
| Client portal | Whichever documents a lawyer explicitly toggles "Share with client" — nothing else | Client logs in and downloads | Access is scoped to `matter.clientId === clientUser.clientId` and `document.sharedWithClient = 1`, checked server-side on every request; DLP-lite rate limiting applies (see §7) |
| Signing/intake links | Whatever document or questionnaire the link is scoped to | Client opens a single-use, expiring, resource-scoped token link (`src/lib/clientAccess.ts`) — no login, no broader account access | Token is scoped to exactly one resource, expires, and is revoked when a new one is issued for the same resource |

**No other third parties receive personal information.** There is no analytics
SDK, no error-tracking/telemetry service, no advertising pixel, and no
CRM/marketing integration in this codebase.

## 5. Technical safeguards actually implemented

- **Encryption at rest:** documents and select text fields are AES-256-GCM
  encrypted (`src/lib/crypto.ts`) with a random IV and auth tag per file. The
  32-byte master key is stored in the macOS Keychain where available, or a
  `0600`-permission file outside the `data/` directory otherwise
  (`src/lib/masterKey.ts`) — deliberately **not** inside `data/`, so a copy of
  the data directory (e.g. a backup archive) alone cannot decrypt anything.
  **This is a real operational risk, not just a safeguard — see the incident
  runbook's "lost master key" scenario.**
- **Password storage:** scrypt-hashed, per-user random salt, both for staff
  accounts and client portal accounts — plaintext passwords are never stored.
- **MFA:** optional RFC 6238 TOTP (`src/lib/totp.ts`), implemented directly on
  `node:crypto`, verified against the RFC 4226 Appendix D test vectors. Backup
  codes are one-time and hashed at rest like passwords.
- **Malware scanning:** every uploaded document (matter documents and reference
  library) is scanned via a local ClamAV binary before being written to the
  normal storage path; anything flagged goes to a quarantine directory instead
  and is never chunked, extracted, or shown as chat-readable.
- **Access control:** session-cookie auth (`src/proxy.ts`) gates every route;
  per-matter ethical walls restrict a matter to its assigned team plus admins
  when enabled; the client portal is a fully separate identity/session realm
  with no visibility into anything beyond its own client's matters and
  explicitly-shared documents.
- **Tamper-evident audit log:** every state-changing action writes a hash-chained
  row (`src/lib/db.ts` `computeAuditRowHash`) — deleting or editing a past row
  breaks the chain from that point forward, detectable via
  `verifyAuditLogIntegrity()` and visible at `/audit`.
- **DLP-lite guards:** rate limiting and above-threshold audit alerting on the
  three actions that move data out in bulk — full-database backup downloads,
  matter emails with attachments, and client-portal document downloads
  (`src/lib/exportGuard.ts`). Not a real DLP system (no content inspection, no
  network egress control) — see §8.
- **PII masking before AI calls:** described in §4.

## 6. Data residency

Data residency is determined entirely by **where the machine running this app
physically is** — the application makes no choice here and enforces no
residency policy. If this is run on a machine physically located in Canada, all
locally-stored data (§3) stays in Canada. The moment a document's text is sent
to an AI provider (§4), residency depends on that provider's own infrastructure
and terms:

- **Ollama:** runs on the same machine — no residency change at all.
- **Anthropic, OpenAI, Google Gemini:** each has its own data-processing
  location and terms, generally outside Canada unless a specific
  enterprise/regional agreement says otherwise. **This has not been separately
  verified against each provider's current terms as of this assessment** — if
  data residency is a hard client requirement for a given matter, either use
  Ollama exclusively for that matter or confirm the specific provider's current
  regional processing terms before enabling AI features on it.

**No formal data residency attestation exists for this system.** Producing one
would require (a) confirming and documenting the physical hosting location,
and (b) obtaining/reviewing each enabled AI provider's current data-processing
addendum — both are one-time research/paperwork tasks for the account owner,
not something the codebase can determine or enforce on its own.

## 7. Retention and disposal

- Matters carry a `retentionDate` field and a `legalHold` flag
  (`src/lib/matters.ts`) — a matter on legal hold cannot be deleted; retention
  dates are informational (surfaced in the UI) rather than an automatic purge
  job as of this assessment.
- Deleting a matter cascades to all its documents, chat history, generated
  analyses, time entries, and related records (`deleteMatter()`), removing the
  underlying encrypted files from disk.
- Backups are a separate, admin-managed lifecycle (list/create/delete via
  Settings > Backup) — deleting a matter does **not** retroactively scrub it
  from backups already taken before the deletion. If a specific client's data
  must be fully purged (e.g. a deletion request), backups predating that
  deletion still contain it until they themselves age out or are deleted.
- There is no automatic backup expiry/rotation policy configured by default —
  this is an operational decision for the admin to set and follow.

## 8. Known gaps and residual risk (honest, not aspirational)

1. **No independent penetration test or third-party security audit has been
   performed.** Everything in §5 is a self-implemented control, verified by the
   person who built it. This is appropriate for the firm's current size but
   should be revisited if the firm grows, takes on more sensitive matter types,
   or a client specifically requires third-party security validation.
2. **Matter classification (standard/privileged/highly sensitive) does not
   currently gate which AI provider a matter can use.** A privileged matter can
   still be sent to a third-party AI provider like any other matter. If a
   client's instructions require certain matters to never leave the machine,
   that currently has to be enforced by staff discipline (choosing Ollama
   manually), not by the system.
3. **No vendor security assessment has been done on the AI providers, SMTP
   host, or OAuth providers** used by this system — the firm is relying on
   each vendor's own public terms and security posture, not an independent
   review of it.
4. **Data residency is not enforced or attested**, per §6.
5. **DLP-lite is exactly that** — rate limiting and audit alerting on three
   specific bulk-export paths, not content inspection, not network-level
   egress control, and not coverage of every conceivable way data could leave
   (e.g. a screenshot, a staff member manually copying text out of the chat UI).
6. **Single point of key custody.** The master encryption key (§5) has no
   secondary custodian, no documented recovery procedure beyond "it's in the
   Keychain or the fallback file," and no key-rotation mechanism. Losing it
   means losing access to every encrypted document, including in backups.
7. **This assessment itself has not been reviewed by anyone other than the
   system owner.** Treat it as a starting point for a real conversation with
   the firm's actual privacy/compliance obligations, not a substitute for
   professional legal/compliance advice.
