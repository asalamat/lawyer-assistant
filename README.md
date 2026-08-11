# Lawyer Assistant

A self-hosted legal matter-management and AI-assisted case-work platform,
built for a small law office or solo practice that wants the organization
and AI leverage of a big-firm tool without sending client data to yet
another vendor's cloud.

Everything runs on one machine you control — a local SQLite database, local
file storage, your own choice of AI provider. There is no vendor
subscription, no third-party server holding your matters, and no seat
licensing: add as many lawyers and staff as your office needs.

## ✨ Features at a glance

**📁 Matter & Client Management**
- 🗂️ Matters with file numbers, status, classification, legal holds, retention dates
- 👥 Client roster (individual/corporate/institutional) with auto-linked matters
- ⚠️ Conflict-of-interest checking (exact + near-miss name matching) on intake
- 🔗 Parties tracking per matter, related-matters linking
- 🚧 Per-matter ethical walls (restrict a matter to its assigned team)
- ✅ Client intake forms + e-consent capture

**📄 Document Intake & Processing**
- 📤 Drag-and-drop upload: text, PDF, Word, Excel/CSV, images (OCR), audio/video (transcription)
- 🛡️ Local malware scanning (ClamAV) with quarantine
- 🔁 Exact-duplicate (hash) and near-duplicate (similarity) detection
- 📦 Bulk ZIP/folder import
- 🌐 Language auto-detection, table-structure preservation, failed-extraction review queue
- 📸 AI photo analysis (vision) — real description of an image's visual content
- 📚 Shared reference library (firm precedents + public legal authority)

**🤖 AI-Powered Legal Work Product**
- 💬 Grounded chat Q&A, every fact cited to source document + page
- 🧾 Matter digests, evidence-mapping matrices, contradiction detection
- 📋 Exhibit lists, disclosure-completeness checklists, Crown-position analysis, privilege review
- 🛡️ Defence strategy memos, missing-evidence rollup report
- ⏰ Deadline extraction (AI) + rules-based deadline calculator
- ✍️ First-draft memos/letters/correspondence, smart email drafting
- 🔍 Self-checking drafting agent (verifies its own citations)
- 📜 Contract clause library + AI redlining
- ⚖️ Case-citation checking against CanLII
- 🧠 Independent second-model review (Gemini) for blind spots
- 🎙️ Voice dictation on every free-text field
- 🌍 Translation of any AI output + clean PDF export
- 🕸️ Evidence graph, defence graph, evidence-connections graph (visual node maps)

**🏛️ Client Portal**
- 🔐 Persistent client login (separate identity from staff)
- 💌 Lawyer-controlled per-document visibility, portal messaging

**📈 Leads / CRM**
- 🗓️ Kanban pipeline (new → contacted → consultation → proposal → won/lost)
- ➡️ Convert lead → real matter/client; public embeddable lead-intake form
- 📧 Marketing drip campaigns (staged email sequences)

**💼 Practice Management**
- ⏱️ Timesheets, invoicing, SMTP email sending with attachments
- 💰 Trust accounting (compliance-first ledger, bank reconciliation)
- ✔️ Task/to-do management per matter
- 🧩 Document assembly templates + DOCX export
- ✒️ E-signature requests and signing flow
- 📊 Firm analytics dashboard (WIP, billed vs. collected, hours/attorney)
- 🔎 Saved searches/reports, global search

**📬 Communications**
- ✉️ Connected email (Gmail, Outlook/O365, Yahoo) — browse, import to matter
- 👀 Legislation watch (CanLII) for tracked statutes

**🔒 Security & Governance**
- 🧑‍⚖️ Multi-user accounts + roles, TOTP MFA with backup codes
- 🔐 Encryption at rest for API keys, credentials, and documents
- ⛓️ Cryptographically tamper-evident audit log (hash-chained)
- 🕶️ PII masking (SIN/SSN/credit card/phone/email) before any AI call
- 🚫 Login rate limiting, DLP-lite export/download alerting
- 📝 Privacy Impact Assessment + Incident Response Runbook

**☁️ Backup & Infrastructure**
- 🆕⏱️ **Two automatic backup triggers, no OS cron needed** — a fixed interval (hourly by default) *and* a debounced trigger that backs up shortly after real activity settles down, each independently configurable
- 🆕🧙 **One-click setup wizard for cloud backup** — installs `rclone` itself if it's missing, then drives the whole OAuth sign-in for OneDrive/Google Drive end to end; the only manual step left is approving access in the browser that pops open
- ☁️ **Cloud backup, any provider you like** — S3-compatible (AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO), Google Drive, OneDrive, or `rclone` (the zero-app-registration option)
- 🔌 Public versioned API (`/api/v1`) with API-key auth, outbound webhooks
- 💡 System health dashboard, update checker, feature-request tracking, weather widget, sticky notes, dark mode

## Why a legal office would use this

- **Time savings on the work every matter needs.** Matter digests, evidence
  matrices, deadline extraction, draft correspondence, and grounded Q&A
  against a matter's own documents — all in seconds, not the hours it takes
  to read a disclosure package from scratch.
- **Confidentiality by design, not by policy document.** Documents and API
  keys are encrypted at rest. Every AI answer is grounded only in the
  documents you've actually uploaded to that specific matter — nothing
  leaks across matters, and nothing is used to train anyone's model.
- **Accountability you can show a regulator or a client.** Every action —
  who uploaded what, who asked what, who changed a role, who placed a
  legal hold — is timestamped and attributed, in a log that's
  cryptographically tamper-evident, not just a plain database table someone
  could quietly edit.
- **Built for a team, not just one lawyer.** Real accounts and roles
  (admin/lawyer/staff), a shared client roster, a shared reference library
  for precedents and statutes — the things a two-person office needs on day
  one and a twenty-person office still needs on day one thousand.
- **Honest about AI's limits.** Every AI-generated fact is cited to its
  source document and page. Draft output is explicitly marked as a draft
  for review, never as advice or a final document. Where a feature can't be
  done reliably (see "Known limitations" below), it says so instead of
  faking it.

## What it does

**Matter & client management** — matters with file numbers, status
lifecycle (open/closed/archived), classification (standard/privileged/
highly-sensitive), legal holds that block deletion, retention dates,
conflict-of-interest checking (exact and near-miss name matching) on
intake, and a client roster (individual, corporate, or institutional, with
contact person and registration number for the latter two) that
automatically links a client's matters together.

**Document intake** — drag-and-drop upload of text, PDF, Word, Excel/CSV,
images (OCR), and audio/video (transcription); local malware scanning
(ClamAV) before anything is stored or read, with infected files quarantined
rather than silently rejected; exact-duplicate detection by content hash,
plus near-duplicate detection by content similarity for re-scanned or
reformatted copies; automatic language identification and a processing-
quality score per document; table structure preserved (as markdown tables)
instead of flattened, for both PDFs (vector-grid detection) and Word
documents; email attachments imported and linked back to the email they
arrived with; a review queue for documents that fail extraction, with a
one-click retry; a reference library split into firm knowledge (precedents,
internal know-how) and public legal authority (statutes, case law), each
attachable to whichever matters need it.

**AI features, grounded, cited, and checked** — chat Q&A (retrieval-based
with hybrid vector + lexical re-ranking and parent-child context expansion,
so it stays fast and accurate even on large matters), executive digests,
evidence-mapping matrices, contradiction/witness-inconsistency detection,
exhibit lists, disclosure-completeness checklists, Crown-position analysis,
privilege/redaction review, defence strategy memos, deadline extraction,
first-draft memos/letters/correspondence, and smart email drafting — every
fact cited to its source document and page number, and every generated
document independently double-checked for citations that don't match a
real document in the matter, flagged in the UI rather than trusted blindly.
An independent second AI model (Google Gemini) can review any digest,
evidence matrix, or chat answer for blind spots. Voice dictation on every
free-text field, for anyone who'd rather speak than type. Any AI-generated
output can be translated into a configurable language (Settings >
Translation), with citations and markdown structure preserved, and
exported as a clean, printable PDF.

**Client portal** — a real, persistent login for clients (not just a
single-use signed link), separate from staff accounts. A lawyer grants
access from the client's own page and chooses exactly which documents are
visible; the client logs in anytime to see their own matters, download
whatever's been shared with them, and exchange messages directly with
staff — nothing else.

**Leads / CRM pipeline** — a kanban-style board for tracking prospective
clients before a matter exists (new → contacted → consultation scheduled →
proposal sent → won/lost); converting a lead creates a real matter (and
client, if needed) the same way the normal new-matter flow does, with the
lead's own record kept intact and linked afterward.

**Trust accounting** — a compliance-first client-funds ledger: deposits,
withdrawals, and transfers per matter against one or more trust accounts,
with balances always computed fresh from transaction history (never a
stored number that could drift), a hard rejection of any transaction that
would take a matter's balance negative, and permanent reconciliation
records against a bank statement.

**Rules-based deadline calculator, with a native calendar** — a
firm-editable library of deadline rules (e.g. "21 business days after
service," correctly skipping weekends and a configurable holiday list)
that computes a deadline straight into a matter's existing list, alongside
whatever the AI already extracted. Every deadline shows up automatically on
a firm-wide calendar (`/calendar`) and on its matter's own calendar tab —
one data source, two views, no external account or sync step involved.
Ad-hoc events can be added directly, each with an optional reminder lead
time. Reminders surface through an in-app notification bell, email, and
(if enabled per-device) a browser push notification.

**Document assembly templates** — reusable, plain-text templates with
`{{field}}` placeholders; matter/client/date fields fill in automatically,
anything else prompts for a value at generation time. A generated document
can be translated, exported as PDF, or saved into the matter's own document
list.

**Firm analytics dashboard** — matters opened/closed by month,
work-in-progress (unbilled time value), billed vs. collected, top matter
types, and hours logged per attorney — all computed from the same
matters/time-entries/invoices data shown elsewhere, visible to admins and
lawyers, not staff.

**Visual evidence & defence graphs** — turns a generated evidence matrix
or defence strategy memo into an interactive node graph (parties,
allegations, evidence, gaps; or weaknesses, theories, issues, next steps)
you can click through to narrow down what you're looking at, opened
full-screen in a distraction-free view.

**Self-checking drafting agent** — an optional, more advanced way to
generate a draft: instead of one prompt and done, it actively searches the
matter's own documents to verify its own citations and revises itself
(bounded to a couple of rounds) if one doesn't hold up, with a full
step-by-step trace you can inspect. Read-only, one matter at a time, no
irreversible actions.

**Practice management** — timesheets, invoicing with configurable rates
and discounts, direct email sending with attachments and AI-assisted
drafting, connected-inbox browsing (Gmail/Microsoft/Yahoo) with import to
a matter, and private sticky notes pinned to any page (a matter tab, the
dashboard, settings) as personal reminders only you ever see.

**Security & governance** — real multi-user accounts and roles;
two-factor authentication (QR-code enrollment, backup codes); per-matter
ethical walls that restrict a matter to its assigned team, enforced on
every page and API route; local malware scanning on every upload; API keys,
SMTP credentials, and uploaded documents encrypted at rest; a
cryptographically tamper-evident audit log with a one-click integrity check
(and an admin-gated, written-reason-required re-anchor path for the rare
case the chain needs deliberate repair); per-matter legal holds and
classification; SIN/SSN/credit card numbers (and, optionally, phone numbers
and email addresses) automatically masked out of matter content before it's
sent to any AI provider, on by default (Settings > Privacy); DLP-lite
rate-limiting and audit alerting on bulk exports/downloads (full backup
downloads, matter emails with several attachments, a client pulling many
portal documents at once); a written [privacy impact
assessment](docs/PRIVACY_IMPACT_ASSESSMENT.md) and [incident response
runbook](docs/INCIDENT_RESPONSE_RUNBOOK.md), honest about what's covered
and what isn't.

**Backup & restore** — one-click backup of the entire app (matters,
documents, clients, users, settings) to a downloadable archive, with
automatic pruning to the last 10; restore moves current data aside rather
than deleting it. **Two independent, built-in automatic triggers** — no
OS-level cron job required, though the unattended endpoint is still there
for anyone who prefers wiring it into their own cron/Task Scheduler:
- ⏰ a **fixed interval** (hourly by default, configurable)
- 🌊 a **debounced activity trigger** — backs up shortly after real
  changes in the app go quiet, with a minimum cooldown so a busy stretch
  can't fire off backups back to back

Optional off-site copy to cloud storage of your choice — **any S3-compatible
bucket** (AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO…), **Google
Drive**, **OneDrive**, or **`rclone`** (the only option needing zero cloud
app registration, since rclone ships its own). A **setup wizard** drives the
whole thing for Drive/OneDrive-via-rclone: it installs `rclone` itself if
it's missing, then walks the entire OAuth handshake automatically — the
only step left for a human is clicking through the Microsoft/Google sign-in
that opens in the browser. Every backup is encrypted the same way as
everything else at rest, and Drive/OneDrive access is scoped to a single
dedicated backups folder the app creates for itself, never the rest of your
account.

Full detail on every feature, including what's deliberately *not* built
and why, is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Quick start

**macOS / Linux:**
```bash
git clone https://github.com/asalamat/lawyer-assistant.git && cd lawyer-assistant && npm install && npm run dev
```

**Windows** (Command Prompt or PowerShell 7+):
```bat
git clone https://github.com/asalamat/lawyer-assistant.git && cd lawyer-assistant && npm install && npm run dev
```

Then open `http://localhost:3000` — first run prompts you to create the
first admin account, and AI features are configured afterward from inside
the app at Settings (no `.env` editing required). Full details, including
Windows-specific notes, two-factor authentication, how to add more user
accounts, and how to uninstall cleanly, in
[docs/INSTALLATION.md](docs/INSTALLATION.md).

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 ·
`node:sqlite` (no external database server) · Anthropic Claude for primary
AI features, with optional OpenAI, Google Gemini, and local Ollama failover,
automatically routed to a lower-cost model for simple extraction tasks and
the flagship model for real legal reasoning. Runs identically on macOS,
Windows, and Linux.

## Recent changes

- 🆕📅🔔 **Native calendar + reminders, no external calendar account
  needed** — deadlines and ad-hoc events now live entirely in the app
  itself: a firm-wide calendar (`/calendar`) and a per-matter calendar tab,
  both views over the same data. Replaces the old Google/Microsoft OAuth
  calendar-push integration entirely — that path required a developer-
  registered cloud app per provider, which was too much setup burden for a
  non-technical firm to maintain. Reminders now go out through an in-app
  notification bell, email, and an opt-in browser push notification
  (`Settings > Security`), all driven by one hourly scheduler with no
  OAuth, no app registration, and nothing that can go stale or get revoked
  on the provider's side.
- 🆕⏱️ **Two built-in automatic-backup triggers** (`Settings > Backup`) — no
  OS-level cron job needed anymore for either: a fixed interval (hourly by
  default) and a debounced trigger that backs up shortly after real
  activity in the app settles down, capped by a minimum cooldown so a busy
  stretch can't fire off backups back to back. They run independently and
  can both be on at once.
- 🆕☁️ **Cloud backup, any provider** — any S3-compatible bucket (AWS S3,
  Cloudflare R2, Backblaze B2, Wasabi, MinIO), Google Drive, OneDrive, or
  **`rclone`** — the only option needing zero cloud app registration at
  all, since rclone ships its own already-registered Microsoft/Google app.
- 🆕🧙 **One-click cloud-backup setup wizard** — installs `rclone` itself
  (via Homebrew/winget) if it's missing, then drives rclone's own
  non-interactive OAuth protocol end to end: picking account type,
  resolving the right drive, all of it — the only step left for a human is
  approving access in the Microsoft/Google sign-in page that opens
  automatically. Falls back to a plain question (never a silent guess) for
  anything it doesn't recognize — caught a real bug live where an account
  with multiple Microsoft-managed storage resources needed exactly this
  fallback to pick the actual OneDrive instead of an unrelated one.
- In-app Help rebuilt as a single, filterable reference guide (`/help`) —
  every entry numbered and grouped the same way as the app's own
  navigation, a live filter box, and scroll-aware active-section
  highlighting, replacing the old one-page-per-topic browsing
- System status dashboard extended with row counts and integration checks
  for every subsystem added below (leads, trust accounts/transactions,
  portal messages, document templates, assembled documents, deadline
  rules)
- Leads / CRM pipeline (`/leads`) — a kanban-style board for prospective
  clients before a matter exists, converting straight into a real matter
  (and client) when ready
- Document assembly templates (`Settings > Document templates`) —
  plain-text templates with `{{field}}` placeholders, auto-filled matter/
  client fields, and a per-matter generator with translate/export/save-as-
  document actions
- Firm analytics dashboard (`/analytics`, admins and lawyers only) —
  matters opened/closed, work-in-progress, billed vs. collected, top
  matter types, and hours per attorney
- Client portal messaging — a real two-way message thread between staff
  and a client, visible on both the matter's own tab and the client's
  portal page
- Rules-based deadline calculator (`Settings > Deadline rules`) — a
  firm-editable rule library (business-day-aware, with a holiday list)
  that computes a deadline straight into a matter's existing list without
  disturbing anything the AI already extracted
- Trust accounting (`/trust-accounting`) — a compliance-first client-funds
  ledger with balances always computed fresh from transaction history, a
  hard rejection of any transaction that would overdraw a matter, and
  permanent bank-reconciliation records
- Private sticky notes on every page — a small floating widget lets each
  user pin freeform, autosaving notes to whatever page they're on;
  personal to that user, never shown to anyone else
- Privacy impact assessment and incident response runbook — real,
  codebase-specific documents (not code), honest about what's covered and
  what isn't
- DLP-lite: rate limiting and audit alerting on bulk exports/downloads
  (backup downloads, matter emails with several attachments, portal
  document downloads)
- Table structure preserved instead of flattened, for both PDF (vector-grid
  detection via `pdf-parse`'s `getTable()`) and Word documents (walking
  mammoth's parsed document tree) — rendered as markdown tables alongside
  the original extracted text
- Persistent, login-based client portal — a real account, separate from
  staff, that a lawyer grants and a client keeps using, in place of a
  single-use signed link per document
- Reference library split into firm knowledge and public legal authority
  tiers, each attachable to a matter independently
- Email attachments imported and linked back to the email they arrived
  with, for Gmail, Microsoft Graph, and IMAP/Yahoo
- Hybrid vector + lexical re-ranking and parent-child chunk expansion for
  matter chat/drafting retrieval — exact-match legal text (names, case
  numbers, statute sections) that pure embedding similarity under-ranks now
  surfaces correctly, and retrieved passages carry surrounding context
  instead of arriving as isolated fragments
- Deterministic citation quality-check extended to every generated-document
  feature (digest, evidence matrix, contradictions, exhibit list,
  disclosure checklist, Crown-position, privilege review), not just chat
  and drafting — flags any cited filename that doesn't match a real
  document in the matter
- Contradiction/witness-inconsistency detection, exhibit lists,
  disclosure-completeness checklists, Crown-position analysis, and
  privilege/redaction review as new AI-generated analyses
- Local malware scanning (ClamAV) on every upload, matter documents and
  reference library alike — infected files are quarantined, never chunked
  or read
- Corporate/institutional client types (contact person, registration
  number) alongside individuals; additional draft types; search filters by
  party/date/type; automatic language identification and a processing-
  quality score per document; insufficient-evidence gating so a
  low-confidence retrieval says so instead of guessing
- Ollama as a fourth AI provider (Settings > AI model) — runs entirely on
  this machine, no account or cost, for offices that want a fully local
  option available as a fallback
- Automatic cost-aware model routing — simple extraction/classification
  tasks (deadlines, sensitivity screening, per-document summarization) use
  each provider's lower-cost model; digests, evidence matrices, drafts,
  and chat always use the flagship model, so quality where it matters is
  never traded for cost
- Large-matter map-reduce fallback for digest/evidence-matrix/deadlines/
  drafts/email-draft/independent-review/self-checking drafting agent —
  documents are summarized individually first when a matter's total text
  is too large for any provider's context window, instead of the request
  just failing
- Per-matter ethical walls (Compliance tab) — restricts a matter to its
  assigned team plus admins, enforced centrally for every page and API
  route, and the matter disappears from the matters list, dashboard,
  search, and related-matter lookups for anyone it's walled off from
- Two-factor authentication (Settings > Security) — QR-code enrollment
  (hand-rolled RFC 6238 TOTP, verified against the official RFC 4226 test
  vectors, no secret ever leaves the app to render the QR code), backup
  codes, required on every login once enabled
- Near-duplicate document detection (content-similarity, not just exact
  file hash) and a failed-extraction review queue with a one-click retry,
  so a document that couldn't be read no longer just silently vanishes
  from AI context
- PII masking (Settings > Privacy) — SIN/SSN/credit card numbers, and
  optionally phone/email, automatically masked out of matter content
  before it reaches any AI provider; on by default, verified live that a
  real SIN and credit card never reached Anthropic in a real digest call
- Full system-status dashboard (`/monitoring`) — click the nav status dot
  for a live, gauge-based view of data integrity, setup completeness,
  encryption, backup freshness, storage, and database stats; admin-only
- Client add/edit/delete, and the new-matter form now autocompletes
  client names against existing clients (auto-filling email on a match)
- Intake agent — suggests tightening a matter's classification
  (privileged/highly-sensitive) based on uploaded content, while it's
  still at the default; never auto-applied, and stops once classified
- Deadline-monitoring agent — deadlines now re-check automatically right
  after a new document lands (upload, bulk ZIP, or email import), instead
  of only on a manual re-extract click
- Browse and import from any folder in a connected mailbox (Gmail label,
  Outlook mail folder, or Yahoo IMAP folder), not just the default inbox
  view
- Self-checking drafting agent — this app's first agentic (tool-calling)
  feature, alongside boolean/document-content search, saved searches,
  similar-document search, a reference-library approval workflow, and
  bulk ZIP document import
- Configurable default translation language (Settings > Translation),
  used by every Translate button across the app
- Visual evidence & defence graphs — click-through node graphs of a
  generated evidence matrix or defence strategy memo, openable full-screen
  in a new tab
- Defence strategy memo draft type, with its own graph view
- Translation of any AI-generated output into another language, and
  browser-native PDF export, on every generated document/answer
- Backup & restore, with a scheduled/unattended backup endpoint
- Voice dictation, smart email drafting, and email attachments
- Client entity with fuzzy (near-miss spelling) conflict-of-interest
  checking
- Real retrieval-based chat (chunking + embeddings) in place of
  full-context injection, so chat stays fast and accurate as a matter's
  document volume grows
- Independent AI review extended to individual chat answers; PDF sources
  now cite a page number
- Matter classification, legal holds, and retention dates
- Tamper-evident, cryptographically hash-chained audit log with a
  one-click integrity check
- Real multi-user accounts and roles, replacing the original single shared
  password
- Encryption at rest for API keys, SMTP credentials, and uploaded documents

Full commit-level history: `git log`. Feature-level history, including the
reasoning behind each decision, is in
[docs/ROADMAP.md](docs/ROADMAP.md#also-built-not-in-the-original-phase-list).

## Known bugs found & fixed

- **Re-extracting AI deadlines would have wiped every rule-computed or
  manually-added deadline on the same matter.** The delete-and-reinsert
  step behind "Re-extract" had no filter, so it cleared the whole
  `matter_deadlines` table for that matter, not just the AI-extracted
  rows. Caught during design review before shipping the deadline
  calculator, fixed by scoping the delete to `source = 'extracted'` and
  confirmed live that a rule-computed deadline survives a re-extract.
- **A lead update could silently wipe every field it wasn't touching.**
  `updateLead()` spread an `updates` object that always had every key
  present (unset fields as explicit `undefined`) over the existing
  record — object spread applies an `undefined` value rather than
  skipping it, so patching just `{stage: "contacted"}` would have erased
  email/phone/source/notes. Confirmed live, fixed with explicit per-field
  fallbacks instead of a blind spread.
- **Deleting a document template could fail outright if any document had
  ever been generated from it.** `assembled_documents.templateId` was a
  hard foreign key with no cascade — confirmed live (`FOREIGN KEY
  constraint failed`), fixed by making it a soft/informational reference,
  consistent with every other "snapshot of a parent at generation time"
  relationship in the app.
- **A non-admin lawyer couldn't create a document template despite the
  feature being open to any user.** `proxy.ts`'s blanket admin-only gate
  on `/api/settings/*` had no exception for the new route. Confirmed live
  (`403 Admins only`), fixed by adding it to the existing exception list
  alongside the page-level equivalent.
- **A failed calendar push showed the raw provider error JSON straight in
  the UI.** Live-testing the real Google Calendar API surfaced a
  multi-line technical error blob instead of something a lawyer could act
  on. Fixed to log the detail server-side and surface a short, actionable
  message ("reconnect the account in Settings") instead.
- **Independent review was silently broken for everyone.** `gemini.ts` was
  hardcoded to a Gemini model Google had retired for this account
  ("no longer available to new users") — every digest/evidence-matrix
  review was failing, not just new ones. Found while testing the chat
  independent-review feature, fixed by switching to a current model
  confirmed working against the real configured key.
- **A RAG regression caught before shipping**: the first version of the
  chunking/retrieval pipeline silently dropped any document that failed
  text extraction from context entirely, instead of telling the model
  "this document exists but couldn't be read" the way the previous
  full-context builder did. Caught in testing, fixed before merging.
- **Empty AI responses were silently saved as real content.** The
  Anthropic/OpenAI completion helpers returned `""` instead of throwing
  when a provider sent back no text — so a failed generation looked
  identical to a genuinely empty one, and got saved rather than retried or
  reported. Found via a real digest that had silently gone blank in
  production. Fixed by throwing on empty output so the existing
  provider-failover/retry logic actually kicks in.
- **Large evidence graphs could be truncated mid-JSON** ("Unterminated
  string in JSON…") on data-rich matters — the token budget for graph
  generation was too small for a real matter's full evidence matrix.
  Raised generation limits across every AI feature and made JSON parse
  failures throw a clear, actionable message instead of a raw parser
  error.
- **A real production audit-log integrity break**, root-caused to matter
  deletion removing rows from the middle of the *globally* hash-chained
  audit log (each matter's rows aren't chained independently) — deleting a
  matter could invalidate every audit entry recorded afterward. Fixed at
  the source (matter deletion no longer touches the audit log at all), and
  a transparent, admin-gated, written-reason-required re-anchor tool was
  added for the already-affected chain — recorded as its own permanent
  audit event, not a silent patch.
- **The drafting agent's search tool would have silently found nothing on
  a matter's very first agentic use.** Its `search_matter_documents` tool
  read from the same chunk store chat retrieval uses, but that store was
  previously only ever populated lazily by chat itself — so on a
  brand-new matter that had never been chatted with, the agent's tool
  calls would all come back "no relevant passages found" despite real,
  relevant documents existing. Fixed by having the drafting agent ensure
  its own chunking up front, the same way chat already does.
- **Deleting a matter left orphaned agentic-trace rows behind.** The new
  `agent_runs` table (the drafting agent's step-by-step trace log) wasn't
  included in matter deletion's cleanup, unlike every other per-matter
  table — confirmed live: rows referencing a deleted matter's ID survived
  deletion. Fixed by adding the missing delete, deliberately *not*
  alongside the audit log's deletion (which stays by design) since a
  trace log has no audit-trail persistence requirement once the draft it
  explains is also gone.
- **Importing an email from a non-inbox Yahoo folder would have fetched
  the wrong message, or none at all.** Caught while adding folder
  browsing, before it shipped: Yahoo IMAP message UIDs are only unique
  within their own mailbox, but the import code hardcoded INBOX when
  fetching a message body — a message found in, say, Sent would be
  fetched by that UID against INBOX instead, either grabbing an unrelated
  message that happened to share the UID or failing outright. Fixed by
  threading the source folder through from the message list all the way
  to the import call. Gmail and Microsoft were never affected — their
  message IDs are unique across the whole mailbox.

## Known limitations (by design, not oversight)

- **No verification of case-law/legislation citations against CanLII.**
  CanLII's public API has no citation-search endpoint at all — confirmed
  against their own documentation, not assumed. Citations against a
  matter's *own* uploaded documents are verified; citations to outside
  case law are not.
- **Ethical walls are opt-in per matter, not the default.** Every matter is
  visible to every staff member unless you explicitly apply an ethical wall
  on that matter's Compliance tab. Fine for a small office where
  confidentiality is normally handled by trust + audit trail — turn a wall
  on for the specific matter a real conflict scenario requires it for.
- **The ethical-wall toggle itself isn't admin-restricted.** Any staff
  member who can open a matter can apply or remove its wall, same as legal
  hold and classification. Revisit if that turns out to be too permissive
  in practice.
- **Matter classification doesn't gate which AI provider a matter uses.** A
  privileged or highly-sensitive matter can still be sent to a third-party
  AI provider like any other matter — if certain matters must never leave
  the machine, that's staff discipline (choosing the local Ollama option)
  today, not something the system enforces.
- **No independent penetration test or vendor security assessment.** Every
  safeguard in this app (encryption, malware scanning, audit log, MFA,
  DLP-lite) is self-implemented and self-verified. Appropriate for the
  current size of office this is built for — see
  [docs/PRIVACY_IMPACT_ASSESSMENT.md](docs/PRIVACY_IMPACT_ASSESSMENT.md) for
  the full, honest list of what hasn't been independently reviewed.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full reasoning behind every
item above, plus what's still queued.
