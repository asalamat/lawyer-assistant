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
- [x] New-law monitoring agent scaffold — Settings > Legal research > Legislation
      watches: add a specific statute/regulation by CanLII database+legislation
      ID, manual "Check now" per watch, plus a `check-all` endpoint for an
      external OS cron job (this app has no built-in scheduler), authenticated
      via a separate auto-generated cron secret rather than the login session.
      **Honest limitation, not a bug**: CanLII's API exposes metadata and a
      section list, not the actual statute text, so this detects repeal
      status/effective-date/section-structure changes only — not in-place
      wording amendments to an existing section. **Not fully activated**: needs
      the same pending CanLII key as above; scaffold is generic (not tied to
      any practice area) per the account owner's choice rather than guessed.

## Phase 5 — Institutional learning

- [x] Lawyer approval/correction workflow on chat answers (thumbs up/down,
      `message_feedback` table, recorded in the audit log)
- [ ] Everything past that (precedent library, formal eval sets, fine-tuning) is
      premature before there's real usage data to learn from — reconfirmed
      2026-08-04 (only 2 real matters exist so far; revisit once real usage
      volume and feedback history make this worth designing for)

## Also built, not in the original phase list

- [x] `/audit` — audit log of matter/document/chat/digest/feedback/status/email
      actions
- [x] `npm run reset-password` for a forgotten single-user password (no in-app
      recovery flow by design — that would be a bypass path, not a safety net)
- [x] Matter status toggle (open/close/reopen/archive) and permanent delete
      (typed-confirmation, cascading removal of all related rows and uploaded
      files) — archived matters are hidden from the default matters list
- [x] Duplicate document detection (SHA-256 content hash per upload)
- [x] Shared reference library (`/reference-library`) — upload statutes,
      case law, or other reference material once, then attach whichever
      documents are relevant to a specific matter from its Overview tab
      (opt-in per matter, not auto-injected everywhere, so an unrelated
      matter doesn't get e.g. the entire Criminal Code stuffed into its AI
      context). Attached documents' text is included in that matter's chat/
      digest/drafts/evidence-matrix/deadlines context, alongside its own
      documents and notes. This is a practical stand-in for the original
      vision doc's "public legal authority" RAG layer — full-text injection,
      not vector retrieval; see the deviations note at the top of this file.
- [x] Dark mode (Light/Dark/System), sectioned Settings page with icons,
      `/help` restructured into a sidebar of per-feature pages (one URL per
      feature, kept current as features land)
- [x] App version shown in Help, Settings > Software updates, and a new
      site-wide footer — replaces the old Dashboard "System info" card
      (dropped in favour of these, plus the new health indicator below)
- [x] System health indicator (nav bar) — a status dot + popover showing
      which subsystems are configured (primary/backup AI, independent review,
      transcription, legal research, email, weather location), each linking
      straight to its Settings page
- [x] Live current-temperature display in the nav, via Open-Meteo (free, no
      API key) — set a location in Settings > Appearance, shown in the
      user's preferred F/C unit
- [x] Per-matter notes — free-text findings included as context the next
      time the matter's digest is generated, alongside uploaded documents
- [x] AI provider redundancy — configure OpenAI as a backup text-generation
      provider (Settings > AI model); if the primary provider fails for a
      request (billing, rate limit, outage) the app automatically falls
      through to the next configured provider in the chosen order
- [x] In-app change-password (Settings > Security), on top of the CLI reset
- [x] Login rate limiting (5 failed attempts → 15 min lockout) on both the
      login and change-password endpoints
- [x] Unified per-matter activity timeline (reuses the audit log, filtered per
      matter — no separate table needed)
- [x] Full visual redesign (warm parchment/ink palette, Fraunces + IBM Plex
      fonts, shared surface-card/btn-primary/badge classes) and advanced
      cross-entity search (`/search` — matters, document filenames, chat
      content, digests, drafts, evidence matrices, one query)
- [ ] **Email integration — Gmail / Microsoft (Outlook.com, Hotmail, Office
      365)** — OAuth 2.0 flow fully built (`src/lib/emailIntegration.ts`,
      Settings > Integrations) but **not functional yet for these two**:
      needs an OAuth app registered with each provider you want to use
      (Google Cloud Console / Microsoft Entra ID), with redirect URI
      `{this app's URL}/api/integrations/{provider}/callback` authorized, and
      the resulting Client ID + Secret entered in Settings. Verified
      everything up to that boundary (credential save, the /connect redirect
      building a correct real Google authorize URL, CSRF state rejection on
      /callback) — cannot verify the token exchange without a real provider
      round-trip.
- [x] **Email integration — Yahoo, working differently from the other two**:
      Yahoo does not grant third-party apps mail-read OAuth access at all
      (their own developer docs: self-serve app creation cannot be granted
      mail scopes), so it connects via an app password over IMAP instead
      (`src/lib/yahooImap.ts`, using `imapflow`/`mailparser`) — no OAuth app
      registration needed for Yahoo, just a Yahoo app password (Account
      Security > Generate app password, after enabling Two-Step
      Verification). Verified live against Yahoo's real IMAP server.
- [x] Gmail/Microsoft/Yahoo inbox browsing + import-to-matter
      (`src/lib/emailRead.ts`, `ImportEmailPanel.tsx`) — lists recent
      messages and imports a selected one into a matter as a document.
      Functional for Yahoo now; functional for Gmail/Microsoft once their
      respective OAuth apps are registered per the item above.
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
- [x] Encryption at rest for API keys/SMTP password (`src/lib/settings.ts`,
      AES-256-GCM via `src/lib/crypto.ts`) and uploaded documents
      (`src/lib/matters.ts`, `src/lib/referenceLibrary.ts`) — the master key
      lives in the macOS Keychain (`src/lib/masterKey.ts`), separate from the
      disk holding the encrypted data, with a file-based fallback for
      non-macOS/headless environments. Both are self-migrating: settings
      written before this shipped, and documents uploaded before it shipped,
      transparently upgrade to encrypted-at-rest the next time they're read —
      no separate migration script, no risk of a one-time script missing a
      file. Passwords/session tokens were already salted hashes / random
      tokens, not reversible secrets, so they weren't in scope for this.
      Deliberately *not* in scope: encrypting document text/chat content
      inside the SQLite DB itself, which would break the existing plain-SQL
      `LIKE` search (`/search`) unless replaced with searchable/vector
      retrieval — see Phase 2-equivalent RAG work below. FileVault (already
      on) covers whole-disk-at-rest for the DB file in the meantime.
- [x] Real multi-user accounts with roles (`src/lib/auth.ts`, `users` +
      `sessions` tables in `src/lib/db.ts`) — replaces the single global
      password/session-token model. Roles: admin (full access, including
      Settings/API keys and user management), lawyer, staff (lawyer and
      staff currently have identical permissions — everyone sees every
      matter by design choice, not an oversight; per-matter ethical walls
      were explicitly deferred until a real conflict scenario needs them).
      Admin creates accounts from Settings > Users with a one-time-shown
      temporary password; the new user must set their own password on
      first login (`mustChangePassword`, enforced by a redirect in
      `src/proxy.ts`). Sessions are stored as SHA-256 hashes in the
      `sessions` table (not raw tokens), expire after 30 days, and are
      invalidated on deactivation/password reset. Settings pages/APIs
      (API keys, SMTP, integrations, system updates, user management) are
      admin-only; Appearance and Security (own password change) are open
      to everyone. The audit log now attributes every event to the acting
      user (`recordAuditEvent` reads the session internally, so no call
      site needed updating) — user-management actions themselves
      (create/deactivate/role change/password reset) are also audited.
      Existing single-user installs migrate automatically on first
      startup after upgrading: the old password hash becomes the first
      admin account (same password, no reset needed) — see "Decisions
      that need the account owner" below for how *this* install's admin
      email/name were chosen. `npm run reset-password -- <email>` now
      takes an email argument. Verified live: full login/session/role-gating
      round trip via throwaway test accounts (never the real admin
      account), last-remaining-admin deactivation guard, audit
      attribution — all throwaway data removed after testing.
- [x] Per-matter classification/retention/legal-hold fields (`classification`:
      standard/privileged/highly-sensitive, `legalHold` +
      `legalHoldReason`, `retentionDate` — `src/lib/db.ts`,
      `src/lib/matters.ts`). Editable from a new "Compliance" section on
      the matter Overview page (`MatterComplianceControls.tsx`); a
      legal-hold badge shows in the matter header whenever active. A
      matter on legal hold can't be deleted — `deleteMatter()` throws and
      the delete-confirmation UI surfaces the real reason instead of a
      generic failure message. Retention date is informational only for
      now (nothing auto-deletes on it — that would need a scheduled job
      plus a real decision about what "expired" should do, which is a
      bigger call than this pass). All changes to these fields are
      audited. Verified live via a throwaway matter: classification
      update, hold-blocks-delete, hold-released-then-delete-succeeds —
      all test data removed afterward.
- [x] Tamper-evident audit log — each row is hash-chained to the one before
      it (`computeAuditRowHash`/`AUDIT_GENESIS_HASH` in `src/lib/db.ts`,
      chained on insert in `recordAuditEvent`, `verifyAuditLogIntegrity()`
      in `src/lib/auditLog.ts`). All 76 pre-existing rows were backfilled
      with hashes on first startup after this shipped, so the entire
      history is verifiable, not just rows going forward. A row edited or
      deleted via direct DB access (bypassing the app) breaks the chain
      from that point on — detectable, not prevented; this is evidence of
      tampering after the fact, not a lock. Admins can check
      Audit log > "Verify log integrity" (`/api/audit/verify`,
      `AuditIntegrityCheck.tsx`). Verified live: real 76-entry history
      passes; a throwaway row inserted via the exact same chaining logic
      passes; tampering that row's `detail` directly via SQL is correctly
      detected and pinpointed to that exact row; removing the (last)
      tampered row restores a clean chain — confirmed via both the
      underlying function and the live HTTP endpoint (200 for admin, 403
      for non-admin). All test data removed afterward.
- [x] Extended independent review (Gemini) to chat Q&A, not just
      digest/evidence-matrix — each assistant chat message now has its own
      "Get independent review" action (`ChatMessages.tsx`), reusing the
      existing `chat_message` addition to `IndependentReview.sourceType`
      and the same `/api/matters/[id]/independent-review` endpoint.
- [x] Per-page metadata for PDF extraction — `textExtraction.ts` now tags
      each page (`[Page N]`) instead of returning one flat string
      (`pdf-parse`'s `getText()` already returns page-wise text via
      `result.pages`, previously discarded in favour of the concatenated
      `result.text`). Chat/digest/draft/evidence-matrix prompts
      (`src/lib/claude.ts`) now ask the model to cite the page too when
      available, e.g. `(file.pdf, p. 4)`. `citationCheck.ts`'s regex now
      parses that optional page suffix so page-qualified citations still
      verify correctly against known filenames instead of being
      misdetected as unverified. DOCX/images/spreadsheets/audio don't get
      page tags — Word documents have no fixed pagination, images are
      inherently one page, and audio/video would need timestamp
      segments instead (not done in this pass).
      **Bug found and fixed along the way**: `src/lib/gemini.ts` was
      hardcoded to `gemini-2.5-flash`, which Google has retired for this
      account ("no longer available to new users") — this silently broke
      *all* independent review (digest and evidence-matrix too, not just
      the new chat path) before this fix. Probed the real configured key
      live against several current model IDs and confirmed
      `gemini-3.5-flash` works; switched to it.
- [ ] **Real citation verification against CanLII (case law/legislation) —
      not done, genuinely blocked, not just deferred.** Two separate
      problems, confirmed by reading CanLII's own API_documentation repo
      (github.com/canlii/API_documentation) rather than guessing: (1) no
      CanLII API key is configured yet (still pending per the "Decisions"
      section below), so nothing here is even live-testable right now;
      (2) more fundamentally, **the API has no full-text or
      citation-search endpoint at all** — only browse-by-database and
      cited/citing-relationship endpoints. The only path to "does this
      citation exist" is deriving a `caseId` from the citation text
      (CanLII's own examples show `2014 ONCA 925` → caseId `2014onca925`)
      and calling the metadata endpoint to see if it 404s — but CanLII's
      docs don't actually state this as a firm rule, just show it in
      examples, and `databaseId` codes (e.g. `onca`, `csc-scc`) aren't a
      guessable pattern — the docs say to call `/caseBrowse/` and read the
      list back, not to hardcode a mapping. Building this now would mean
      shipping a heuristic that's never been tested against a real
      response and could easily produce false "citation not found"
      results for a real, valid case — worse than no feature, for a legal
      tool. Citation checking for the matter's *own* uploaded documents
      (filename + page, see above) is unaffected and works today; this
      item is specifically about verifying case-law/legislation citations
      an AI answer generates against an external authority.

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
6. **Email OAuth app registrations (Gmail, Microsoft)** — Google Cloud Console
   (Gmail) and/or Microsoft Entra ID app registration (covers
   Outlook.com/Hotmail/Office 365 in one app), each yielding a Client ID +
   Secret to enter in Settings > Integrations. The code is ready — connecting
   an account, browsing its inbox, and importing a message into a matter as
   a document (`src/lib/emailRead.ts`, matter Email tab) are all built — but
   nothing will connect for these two until at least one OAuth app exists.
   ~~Yahoo~~ needs no such registration — it's **resolved** via an app
   password over IMAP instead (see above), which is already working.
7. ~~**Multi-user access model**~~ — **Resolved 2026-08-04.** Confirmed:
   every user sees every matter (roles gate admin/settings actions, not
   matter visibility — per-matter ethical walls deferred until a real
   conflict needs them); admin creates accounts manually with a
   temporary password (no self-registration/invite-link surface). First
   admin account: ali.salamat@cortexhq.ai / Ali Salamat, migrated from
   the pre-existing single password (same password, no reset needed).
