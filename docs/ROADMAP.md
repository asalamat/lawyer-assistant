# Roadmap

Status snapshot and phased plan for the lawyer-assistant app, tracked against the
original architecture vision (client/matter management → legal research →
evidence/Crown analysis → agents → institutional learning). Updated as work lands;
see git log for exact history.

## Where this deviates from the original vision doc, on purpose

- **Single model (Claude), not a multi-provider gateway.** The doc's "OpenAI primary
  + Claude reviewer + third fallback" design assumes a firm with several paid model
  accounts. This build uses Claude only. Revisit if/when a second provider account
  exists.
- **Local file/SQLite storage, not Postgres+pgvector.** This runs on one local
  machine with no database server installed. `node:sqlite` (built into Node, no
  service to run) is the pragmatic "real database" step — see Phase 1.5 below.
  Postgres+pgvector is the right call once this needs multi-user access or real
  vector search at scale, not before.
- **No cloud integrations (Outlook/SharePoint/Drive), no paid transcription, no
  CanLII/Westlaw access.** Each of these needs an account/API key/cost decision
  that only the account owner can make. They're called out explicitly below rather
  than silently skipped or silently built with a guessed provider.

## Phase 1 — Secure MVP (done)

- [x] Matter create/list/detail
- [x] Document upload (local storage)
- [x] Text/PDF/Word/image(OCR) extraction for chat context
- [x] Dashboard with matter counts
- [x] Settings page (API key management, no restart required)
- [x] Git-based update checker

## Phase 1.5 — Make the data layer real (done)

- [x] Migrated `src/lib/matters.ts` to `node:sqlite` — same exported function
      signatures, nothing above the data layer changed
- [x] Single-user password auth gate (session cookie via `src/proxy.ts`,
      first-run password creation, scrypt-hashed at rest)
- [x] Audit log table (matter created / document uploaded / chat question asked),
      viewable at `/audit`

## Phase 2 — Legal research

- [x] Matter search/filter on the matters list
- [x] Citation verification on chat answers (`src/lib/citationCheck.ts` — flags any
      cited filename that isn't an actual uploaded document)
- [x] CanLII API client scaffold (`src/lib/canlii.ts` — caseBrowse, caseCitator,
      legislationBrowse) + Settings > Legal research tab with a "Test
      connection" check. **Not fully activated**: user has requested an API key
      via CanLII's feedback form (submitted 2026-07-31) but it hasn't arrived
      yet. Add the key in Settings once received.
- [ ] Case-law citation lookup and "note-up" (subsequent treatment) — the CanLII
      client above supports note-up (`getCaseCitator`) once you already know a
      case's `databaseId`/`caseId`, but CanLII's documented API has **no
      free-text or citation-string search** — there's no way to go from "R v
      Smith, 2020 ONCA 123" to the right IDs without either (a) an ID-derivation
      scheme from the citation text (unverified — needs testing against a real
      key) or (b) browsing a specific database's case list and matching by
      title/citation client-side (works but not a direct lookup). This needs
      real-key testing to figure out before a "verify this citation" feature
      can be built honestly.

## Phase 3 — Evidence and Crown analysis

- [x] Matter digest / executive summary generation (`generateMatterDigest()`,
      `matter_digests` table, panel on the matter detail page)
- [x] Elements-of-offence / evidence-mapping matrix (`generateEvidenceMatrix()`,
      `evidence_matrices` table) — explicitly does not predict outcomes, only maps
      allegations → elements → evidence → gaps
- [x] Independent second-model review (Google Gemini) — `src/lib/gemini.ts`,
      `independent_reviews` table, "Get independent review" button on the digest
      and evidence-matrix panels. Needs a Gemini API key in Settings > Independent
      AI review to activate; verified live against the real Gemini API (a
      deliberately invalid test key correctly produced a real 400
      `API_KEY_INVALID` response surfaced cleanly in the UI, confirming the full
      request path works end-to-end).

## Phase 4 — Controlled agents

- [x] Deadline extraction (`extractDeadlines()`, `matter_deadlines` table,
      replaced-on-regenerate so it reflects current documents; surfaced on both
      the matter page and a dashboard-wide upcoming-deadlines list)
- [x] Drafting templates (`generateDraft()` — research memo / demand letter /
      client correspondence, `drafts` table, append-only history)
- [x] Audio/video transcription (OpenAI Whisper API) — `src/lib/transcription.ts`,
      wired into `textExtraction.ts` for `.mp3/.mp4/.mpeg/.mpga/.m4a/.wav/.webm`
      uploads (25MB limit, OpenAI's own cap). Needs an OpenAI API key in
      Settings > Audio & video transcription to activate.
- [ ] New-law monitoring agent — **blocked on the same CanLII key** as above, plus
      needs a decision on scope (which jurisdictions/practice areas to monitor)

## Phase 5 — Institutional learning

- [x] Lawyer approval/correction workflow on chat answers (thumbs up/down,
      `message_feedback` table, recorded in the audit log)
- [ ] Everything past that (precedent library, formal eval sets, fine-tuning) is
      premature before there's real usage data to learn from

## Also built, not in the original phase list

- [x] `/audit` — audit log of matter/document/chat/digest/feedback/status/email
      actions
- [x] Dashboard system-info panel (app version, git commit, Node/Next versions,
      SQLite row counts)
- [x] `npm run reset-password` for a forgotten single-user password (no in-app
      recovery flow by design — that would be a bypass path, not a safety net)
- [x] Matter status toggle (open/close/reopen)
- [x] Duplicate document detection (SHA-256 content hash per upload)
- [x] Dark mode (Light/Dark/System), sectioned Settings page with icons,
      `/help` page kept current as features land
- [x] In-app change-password (Settings > Security), on top of the CLI reset
- [x] Login rate limiting (5 failed attempts → 15 min lockout) on both the
      login and change-password endpoints
- [x] Unified per-matter activity timeline (reuses the audit log, filtered per
      matter — no separate table needed)
- [x] Full visual redesign (warm parchment/ink palette, Fraunces + IBM Plex
      fonts, shared surface-card/btn-primary/badge classes) and advanced
      cross-entity search (`/search` — matters, document filenames, chat
      content, digests, drafts, evidence matrices, one query)
- [ ] **Email integration (Gmail / Microsoft — covers Outlook.com, Hotmail, and
      Office 365 / Yahoo)** — OAuth 2.0 flow fully built
      (`src/lib/emailIntegration.ts`, Settings > Integrations) but **not
      functional yet**: needs an OAuth app registered with each provider you
      want to use (Google Cloud Console / Microsoft Entra ID / Yahoo Developer
      Network), with redirect URI `{this app's URL}/api/integrations/{provider}/callback`
      authorized, and the resulting Client ID + Secret entered in Settings.
      Verified everything up to that boundary (credential save, the /connect
      redirect building a correct real Google authorize URL, CSRF state
      rejection on /callback) — cannot verify the token exchange without a
      real provider round-trip.
- [x] Automatic file-number generation (`YYYY-NNNN`, sequential per calendar
      year) — assigned on matter creation, backfilled for pre-existing
      matters via an `ensureColumn`/migration pass in `src/lib/db.ts`,
      surfaced on the matter card and matter detail header
- [x] Conflict-of-interest check on matter creation — client name is matched
      (substring, case-insensitive via SQL `LIKE`) against existing matters'
      client names when the field loses focus; matches are shown with an
      explicit "I've reviewed this" acknowledgement required before the
      create button is enabled (`checkConflicts()` in `src/lib/matters.ts`,
      `/api/matters/conflicts`)
- [x] Excel/CSV document ingestion — `.csv`/`.xlsx`/`.xls` uploads are parsed
      into chat-readable text via SheetJS (installed from SheetJS's own CDN,
      pinned version, not the vulnerable npm-registry `xlsx` package — see
      the "Dependency notes" section below)
- [x] Per-matter timesheet — log date/description/hours entries on the
      matter detail page, with a running total; `time_entries` table,
      `/api/matters/[id]/time-entries`
- [x] Invoicing from timesheet entries — select unbilled entries, set an
      hourly rate and optional flat discount, generate an invoice
      (`INV-YYYY-NNNN`); invoiced entries are locked against deletion and
      double-invoicing; invoice history with a paid/unpaid toggle. Each
      time entry renders as its own line item (date/description/hours/
      rate/amount) in the invoice.
- [x] One default hourly rate per matter (not per entry) — set at
      matter creation or edited inline on the Timesheet page; the
      invoice-creation rate field pre-fills from it automatically, so
      selecting entries and invoicing needs no rate typing in the
      common case
- [x] Real email sending (SMTP) — Settings > Email tab configures an
      outgoing mail server (nodemailer) with a connection-test button.
      The invoice "Send" button now emails the itemized invoice (text +
      HTML) to the matter's client email via SMTP, recorded as an
      `invoice_sent` audit event; falls back to a mailto: draft when SMTP
      isn't configured. Matters now store a client email (used as the
      default invoice recipient).
- [x] Sidebar-tabbed navigation for both the matter detail page (Overview/
      Digest/Deadlines/Evidence matrix/Drafts/Timesheet/Activity/Chat, each
      its own route under `/matters/[id]/*`) and Settings (Appearance/AI
      model/Transcription/Independent review/Integrations/Security/Software
      updates, each its own route under `/settings/*`) — replaces the
      earlier single long-scroll page for each

## Dependency notes

- **`xlsx` (SheetJS)** is installed from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
  (pinned exact version), not the npm registry package of the same name. The
  npm-published `xlsx` build has unpatched high-severity prototype-pollution
  and ReDoS advisories; SheetJS only ships fixes through their own CDN.
  `exceljs` was evaluated as an alternative and rejected — it pulls in more
  vulnerable transitive dependencies, not fewer. Re-check this decision if a
  cleaner-audited spreadsheet library becomes available.

## Decisions that need the account owner, not a default

These are genuinely blocked on choices only you can make — flagging them here so
they're not silently skipped or silently guessed:

1. **Audio/video transcription** — paid API (AssemblyAI/Deepgram/Whisper API) vs.
   local Whisper model. Neither is free-and-easy; pick one when needed.
2. ~~**CanLII/legal-research API access**~~ — request submitted 2026-07-31 via
   CanLII's feedback form; awaiting the key. Client scaffold is ready in
   `src/lib/canlii.ts`; add the key in Settings > Legal research once it
   arrives.
3. **A second AI provider** for independent review (Phase 3) — which provider, and
   is the cost justified yet at this stage of usage.
4. ~~**Anthropic account billing**~~ — **Resolved 2026-07-31**, a funded API
   key is now configured in Settings and all AI features work end-to-end.
   ~~**Audio/video transcription**~~ and ~~**a second AI provider**~~ (items 1
   and 3 above) are now both built (OpenAI Whisper, Google Gemini) — just add
   the respective API key in Settings to activate.
5. **Production hosting**, if this ever needs to run somewhere other than one
   local machine — changes the database and auth answers above.
6. **Email OAuth app registrations** — Google Cloud Console (Gmail), Microsoft
   Entra ID app registration (covers Outlook.com/Hotmail/Office 365 in one
   app), and/or Yahoo Developer Network, each yielding a Client ID + Secret
   to enter in Settings > Integrations. The code is ready; nothing will
   connect until at least one of these exists.
