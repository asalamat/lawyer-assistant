# Lawyer Assistant

A self-hosted legal matter-management and AI-assisted case-work platform,
built for a small law office or solo practice that wants the organization
and AI leverage of a big-firm tool without sending client data to yet
another vendor's cloud.

Everything runs on one machine you control — a local SQLite database, local
file storage, your own choice of AI provider. There is no vendor
subscription, no third-party server holding your matters, and no seat
licensing: add as many lawyers and staff as your office needs.

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
intake, and a client roster that automatically links a client's matters
together.

**Document intake** — drag-and-drop upload of text, PDF, Word, Excel/CSV,
images (OCR), and audio/video (transcription); duplicate detection by
content hash; a shared reference library for statutes/case law you attach
to whichever matters need them.

**AI features, grounded and cited** — chat Q&A (retrieval-based, so it
stays fast and accurate even on large matters), executive digests,
evidence-mapping matrices, defence strategy memos, deadline extraction,
first-draft memos/letters/correspondence, and smart email drafting — every
fact cited to its source document and page number, unsupported claims
explicitly flagged rather than invented. An independent second AI model
(Google Gemini) can review any digest, evidence matrix, or chat answer for
blind spots. Voice dictation on every free-text field, for anyone who'd
rather speak than type. Any AI-generated output can be translated into a
configurable language (Settings > Translation), with citations and
markdown structure preserved, and exported as a clean, printable PDF.

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
a matter.

**Security & governance** — real multi-user accounts and roles; API keys,
SMTP credentials, and uploaded documents encrypted at rest; a
cryptographically tamper-evident audit log with a one-click integrity
check (and an admin-gated, written-reason-required re-anchor path for the
rare case the chain needs deliberate repair); per-matter legal holds and
classification; SIN/SSN/credit card numbers (and, optionally, phone
numbers and email addresses) automatically masked out of matter content
before it's sent to any AI provider, on by default (Settings > Privacy).

**Backup & restore** — one-click backup of the entire app (matters,
documents, clients, users, settings) to a downloadable archive, with
automatic pruning to the last 10; restore moves current data aside rather
than deleting it; an unattended scheduled-backup endpoint for wiring into
an OS-level cron job/Task Scheduler.

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
Windows-specific notes and how to add more user accounts, in
[docs/INSTALLATION.md](docs/INSTALLATION.md).

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 ·
`node:sqlite` (no external database server) · Anthropic Claude for primary
AI features, with optional OpenAI failover and Google Gemini for
independent review. Runs identically on macOS, Windows, and Linux.

## Recent changes

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

- **No malware scanning on upload.** Both real options (installing
  system-level antivirus, or sending file content to a cloud scanner) have
  real costs — the second one specifically means sending privileged client
  document data to a third party. Skipped deliberately; uploaded files are
  only ever stored and text-extracted here, never executed.
- **No verification of case-law/legislation citations against CanLII.**
  CanLII's public API has no citation-search endpoint at all — confirmed
  against their own documentation, not assumed. Citations against a
  matter's *own* uploaded documents are verified; citations to outside
  case law are not.
- **Everyone sees every matter.** Roles gate admin actions (Settings, user
  management), not matter visibility — there's no per-matter ethical-wall
  feature yet. Fine for a small office where confidentiality is handled by
  trust + audit trail; revisit if a real conflict scenario needs it.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full reasoning behind every
item above, plus what's still queued.
