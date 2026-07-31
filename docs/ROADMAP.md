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
- [ ] CanLII / Justice Laws integration — **blocked on API access**. CanLII's API
      requires a developer agreement; flag to user when ready to pursue.
- [ ] Case-law citation lookup and "note-up" (subsequent treatment) — **blocked on
      a licensed source** (CanLII, Westlaw, or similar)

## Phase 3 — Evidence and Crown analysis

- [x] Matter digest / executive summary generation (`generateMatterDigest()`,
      `matter_digests` table, panel on the matter detail page)
- [x] Elements-of-offence / evidence-mapping matrix (`generateEvidenceMatrix()`,
      `evidence_matrices` table) — explicitly does not predict outcomes, only maps
      allegations → elements → evidence → gaps
- [ ] Independent second-model review — **needs a second model provider account**
      (Anthropic explicitly recommends a *different* provider family for this to be
      meaningful, per the multi-model design)

## Phase 4 — Controlled agents

- [x] Deadline extraction (`extractDeadlines()`, `matter_deadlines` table,
      replaced-on-regenerate so it reflects current documents; surfaced on both
      the matter page and a dashboard-wide upcoming-deadlines list)
- [x] Drafting templates (`generateDraft()` — research memo / demand letter /
      client correspondence, `drafts` table, append-only history)
- [ ] New-law monitoring agent — **blocked on a legal-source API** (same blocker as
      Phase 2's CanLII integration)

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
- [ ] Unified per-matter activity timeline (combining documents/chat/digests/
      deadlines/drafts/evidence-matrix chronologically) — not started
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
2. **CanLII/legal-research API access** — requires signing up and getting a key.
3. **A second AI provider** for independent review (Phase 3) — which provider, and
   is the cost justified yet at this stage of usage.
4. ~~**Anthropic account billing**~~ — **Resolved 2026-07-31**, a funded API
   key is now configured in Settings and all AI features work end-to-end.
5. **Production hosting**, if this ever needs to run somewhere other than one
   local machine — changes the database and auth answers above.
6. **Email OAuth app registrations** — Google Cloud Console (Gmail), Microsoft
   Entra ID app registration (covers Outlook.com/Hotmail/Office 365 in one
   app), and/or Yahoo Developer Network, each yielding a Client ID + Secret
   to enter in Settings > Integrations. The code is ready; nothing will
   connect until at least one of these exists.
