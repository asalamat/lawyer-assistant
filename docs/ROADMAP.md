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

- [x] **Self-checking drafting agent** (`src/lib/draftingAgent.ts`,
      `src/lib/agentRuns.ts`, `agent_runs` table,
      `POST /api/matters/[id]/drafts {agentic: true}`,
      `AgentTraceButton.tsx`) — this app's first genuinely agentic
      feature; everything else is one-shot (single prompt → single
      response). Given a draft type + instructions, runs a real Anthropic
      tool-use loop: the model can call a `search_matter_documents` tool
      (the same `getRelevantChunks()` retrieval chat uses, scoped to one
      matter) whenever it wants to verify a fact or find the right source
      before citing it, instead of only working from the context it was
      given up front. After a draft is produced, every citation is
      deterministically checked against the matter's real
      document/reference-library filenames (`verifyCitations()`,
      `src/lib/citationCheck.ts` — plain string matching, not another AI
      call); if any citation doesn't match a real file, that's fed back
      to the model as a correction instruction and it searches/redrafts
      again. Every tool call, tool result, and revision is logged to a
      trace, persisted per-draft, viewable via "Agent trace" on that
      draft.
      **Guardrails, matching what this feature needs to be safe rather
      than a generic framework for hypothetical future agents**: only one
      tool exists and it's read-only (search, nothing else — no send,
      no delete, no file write); hard iteration caps (4 tool-loop steps
      per pass, 2 revision rounds, so at most ~12 Anthropic calls for one
      draft — a bounded cost/time ceiling, not unlimited
      self-improvement); Anthropic-only (no OpenAI fallback for this
      specific feature — tool-calling shapes differ enough between
      providers that replicating the loop for both wasn't worth it for a
      first agent; the plain one-shot "Generate draft" is unaffected and
      still supports both); scoped to one matter's own documents, same as
      every other retrieval feature in this app.
      Verified live with real Anthropic tool-use calls, not mocked: on a
      brand-new matter that had never used chat (so `document_chunks` was
      empty), the agent's first search still returned real, relevant
      passages — found and fixed a real bug where the search tool relied
      on chunking that previously only happened lazily via chat, so a
      matter's very first agentic draft would have silently found
      nothing; `runDraftingAgent()` now ensures chunking itself,
      matching `getMatterChatContext()`'s existing pattern. Also found
      and fixed a second real bug: `deleteMatter()` didn't clean up
      `agent_runs`, leaving orphaned trace rows referencing a deleted
      matter — added the missing delete, confirmed zero orphaned rows
      after a real matter deletion (deliberately NOT alongside the
      audit_log line, which stays by design — a trace log has no
      audit-trail persistence requirement once the draft it explains is
      also gone). An adversarial test (a documentless matter, instructed
      to cite a nonexistent file) correctly failed to produce any fake
      citation — the model declined to invent a source rather than
      complying, so the self-correction path itself didn't need to fire
      in that case, which is the expected/safe outcome, not a gap.
      Confirmed the audit hash chain stayed valid (192 entries) after all
      cleanup.
- [x] Deadline extraction (`extractDeadlines()`, `matter_deadlines` table,
      replaced-on-regenerate so it reflects current documents; surfaced on both
      the matter page and a dashboard-wide upcoming-deadlines list)
- [x] **Deadline-monitoring agent** (`checkForNewDeadlines()` in
      `src/lib/matters.ts`, wired into all three document-intake paths —
      single upload, bulk ZIP import, email import) — deadlines now
      re-check automatically the moment a new document lands, instead of
      only when a lawyer remembers to click re-extract. Not a
      tool-calling loop like the drafting agent; the "agentic" property
      here is autonomous *triggering* (a new document is the trigger, no
      human click needed), which is a different but equally valid reading
      of what the vision doc's "deadline-monitoring agent" means.
      Best-effort by design — a failure here never fails the upload/import
      itself, which already succeeded independently.
      Two real bugs found and fixed during testing, both in how a single
      real-world deadline mentioned across multiple documents gets
      deduplicated and attributed:
      (1) `extractDeadlines()` re-derives the full deadline list from the
      full document corpus every time, and would list the *same*
      deadline once per source document that mentioned it, so a matter's
      deadline list quietly accumulated near-duplicates as more documents
      arrived — much more visible now that extraction runs on every
      upload instead of an occasional manual click. Fixed with a
      `dedupeExtractedDeadlines()` pass (exact due-date match, or fuzzy
      description match when neither has a date) plus a prompt nudge
      asking the model not to repeat a deadline per source.
      (2) Source attribution: the AI extraction only ever cites *one*
      document per deadline per pass (not every document that actually
      mentions it), so `replaceDeadlines()` now also merges in whichever
      `sourceDocument` was already stored for a matching deadline from
      the *previous* extraction, accumulating attribution across a
      matter's lifetime — and a follow-up bug in that merge itself
      (treating an already comma-joined `sourceDocument` string as one
      opaque token instead of splitting it first, causing the same
      filename to be re-appended and grow unboundedly on repeated
      re-extraction) was caught and fixed before shipping.
      Verified live end-to-end with real AI calls across sequential
      uploads: new-deadline counts were accurate (no false positives from
      wording drift, no false negatives), a deadline mentioned across
      three separate documents stayed as one row with all three
      filenames merged in, and confirmed via a standalone deterministic
      check that repeated re-extraction citing the same source no longer
      grows the list unboundedly. Audit hash chain re-verified valid
      (314 entries) after cleanup.
- [x] **Intake agent** (`suggestMatterClassification()` in
      `src/lib/claude.ts`, `checkMatterClassification()` in
      `src/lib/matters.ts`, `ClassificationSuggestionBanner.tsx`) — the
      practical version of the vision doc's "intake agent" this app's
      architecture actually supports: a matter must exist (with a title
      and client name) before any document can be attached to it, so
      there's no way to "read documents to fill out the creation form"
      the way the vision doc originally frames it. Instead, once a matter
      exists and is still at its default "standard" classification,
      every document-intake path (single upload, bulk ZIP, email import)
      has this read the new content and suggest tightening the
      classification (privileged / highly-sensitive) when it's clearly
      warranted — never applied automatically, always an Apply/Dismiss
      banner. Stops suggesting entirely, with zero further AI calls,
      once the matter is no longer at "standard" — whether that's from
      applying a suggestion or from a lawyer classifying it manually —
      so it never second-guesses a decision that's already been made.
      Verified live with real AI calls: generic content correctly
      produced no suggestion; genuinely privileged-sounding content
      produced a real suggestion with a sensible reason; applying it
      actually changed the matter's stored classification; a further
      upload with equally sensitive content correctly produced *no*
      suggestion once the matter had moved off "standard" (the core
      guard); and a matter classified manually *before* its first
      upload never triggered the AI call at all on that very first
      upload, confirming the guard short-circuits before any AI call,
      not just after a suggestion has been applied once. Audit hash
      chain re-verified valid (328 entries) after cleanup.
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
      **Revisited 2026-08-05, deliberately left as-is**: considered turning
      this into a truly self-running agent (an in-process scheduler
      instead of the manual "Check now" button), the way the drafting/
      deadline/intake agents above run themselves without a click. Decided
      against adding one: this app already has a documented, consistent
      answer for "something needs to run on a schedule without a person
      clicking a button" — an OS-level cron job hitting the existing
      cron-secret-protected `check-all` endpoint (the exact same pattern
      backup scheduling uses, for the exact same reason: no persistent
      service/ops infrastructure to host an in-app scheduler reliably).
      Adding a second, different scheduling mechanism just for this one
      feature would be an inconsistency, not an improvement — anyone who
      wants this fully self-running today already can, by wiring the
      documented cron command. The real remaining gap for this feature is
      the pending CanLII key, not missing agent architecture.

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
- [x] System health indicator (nav bar) — a status dot showing which
      subsystems are configured (primary/backup AI, independent review,
      transcription, legal research, email, weather location).
      **Upgraded into a full admin-only system-status dashboard**
      (`/monitoring`, `src/lib/monitoring.ts`,
      `GaugeCard`/`StackedBar`/`GaugeRing` in `src/components/Gauge.tsx`)
      — clicking the dot now opens a live, uncached snapshot of the whole
      installation instead of just a small popover: circular gauge cards
      for data integrity (the existing audit hash-chain check), setup
      completeness (how many integrations are configured), where the
      encryption key lives (macOS Keychain vs. a local file), and backup
      freshness (age of the most recent backup); plus application info
      (version, git commit, uptime, Node/platform), full database row
      counts, a stacked bar showing storage composition on disk
      (database file / uploaded documents / backups), backup history, and
      the full integrations list. Gated admin-only (`src/proxy.ts`'s
      `ADMIN_ONLY_TOP_LEVEL_PAGES`/`ADMIN_ONLY_API_PREFIXES`) since it
      surfaces infrastructure detail (storage paths, row counts) at the
      same sensitivity tier as Settings, even though the URL lives
      outside `/settings`. For a non-admin, the status dot still shows
      the same color signal but renders as a plain non-clickable span
      rather than a link, so they're never redirected away from wherever
      they were.
      Verified live end-to-end as both an admin (200 on the page and the
      API, real numbers matching independently-run row-count and
      audit-hash-chain spot-checks) and a non-admin (403 on the API, a
      redirect to Settings > Security on the page — the same pattern
      every other admin-only page/API already uses). Also verified the
      gauge math directly in the rendered HTML: valid finite
      `stroke-dasharray`/`stroke-dashoffset` values, a zero-backups case
      rendering a graceful "None"/0%/red gauge rather than a `NaN`, and
      the storage stacked-bar's three segment widths summing to ~100%.
      Zero `NaN` anywhere in the page across both the populated and
      empty-backups cases.
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
- [x] Boolean search syntax + document-content search + highlighting
      (`src/lib/search.ts`, `SearchHighlight.tsx`) — space-separated terms
      are required (AND), a leading `-` excludes a term, quotes match an
      exact phrase. No explicit `OR`: a LIKE-based search over a handful
      of tables doesn't justify the complexity real OR support would need
      (SQLite FTS5) — deliberately scoped out, not an oversight. Added a
      new "Document content" result category that searches
      `document_chunks.text` — the same chunk store chat retrieval already
      uses — so a term buried inside a large PDF is found even when it's
      nowhere in the filename, deduped to one result per document. LIKE
      wildcard characters (`%`, `_`) in a search term are escaped so a
      literal percent sign in a query can't be misread as a wildcard.
      Verified live via a throwaway matter/document: required-AND,
      exclusion, and exact-phrase matching all behaved correctly; found
      and fixed two real bugs before shipping — the "no results" message
      never rendered once `results.terms` (used for highlighting) made
      every results-group check spuriously non-empty, and unescaped `%`/`_`
      in a query term acted as a SQL wildcard instead of a literal
      character. Confirmed the audit hash chain stayed valid (152 entries)
      after cleanup.
- [x] Saved searches (`saved_searches` table, `src/lib/savedSearches.ts`,
      `/api/saved-searches`, `SavedSearchesPanel.tsx` on `/search`) —
      personal to the user who saved it (like Appearance/Translation), not
      shared firm-wide; a saved search is just a label + the raw query
      string, so it automatically benefits from whatever the search syntax
      supports later. Verified live with two throwaway users: create/list/
      delete round-trips correctly, and — the actual point of scoping by
      `userId`, not just displaying it — user B's delete request against
      user A's saved search silently no-ops (`DELETE ... WHERE id = ? AND
      userId = ?`) rather than deleting it or erroring in a way that would
      leak whether the ID exists; user B's own list never showed user A's
      search. Confirmed the audit hash chain stayed valid (152 entries)
      after cleanup; saved-search create/delete deliberately isn't
      audit-logged, same as other personal-preference settings
      (translation language, appearance).
- [x] Similar-document search (`getSimilarDocuments()` in `src/lib/matters.ts`,
      `/api/matters/[id]/documents/[docId]/similar`,
      `SimilarDocumentsButton.tsx` on a matter's Overview tab) — given one
      document, ranks the matter's other documents (plus attached
      reference-library material) by semantic similarity, reusing the
      same chunk embeddings chat retrieval already computes rather than a
      separate model call. Each document's embedding is the centroid
      (average) of its own chunks' embeddings. **Deliberately scoped to
      one matter only** — comparing across matters would mean one
      client's confidential content influencing what's shown for another
      client's matter, which is exactly the cross-matter leakage this
      app's design otherwise avoids.
      Verified live with three real throwaway documents (two about
      unrelated car accidents, one about an unrelated lease dispute): the
      two car-accident documents ranked as by far the most similar pair to
      each other (0.669) versus either one to the lease dispute (~0.2–0.27)
      — genuine semantic similarity despite sharing no exact wording
      (different streets/vehicles/witnesses), not just keyword overlap.
      Scores were symmetric from every document's own perspective,
      confirming the ranking isn't identity-biased or reversed. Confirmed
      a document never appears in its own results, matter deletion
      cascades documents/chunks correctly, and the audit hash chain stayed
      valid (157 entries) after cleanup.
- [x] Reference-library approval workflow (`reference_documents.approved`/
      `approvedBy`/`approvedAt`/`sensitivityFlag` columns,
      `approveReferenceDocument()`, `scanReferenceDocumentForSensitiveContent()`
      in `src/lib/claude.ts`, `/api/reference-library/[id]/approve`) — the
      closest practical stand-in for the original vision doc's "Layer 2
      firm knowledge" approval + de-identification step, without building
      a separate review-queue table. A newly uploaded reference document
      is `approved=0` and cannot be attached to any matter — enforced in
      `attachReferenceDocument()` itself, not just hidden in the UI —
      until a lawyer or admin (not staff) approves it from
      `/reference-library`'s new "Pending approval" section. An AI scan
      flags text that reads like one specific client's personal/privileged
      material rather than genuine shared reference material; this is a
      warning surfaced to the approver, not an automatic block (a
      published case naming real parties will often trip it too, which is
      expected and fine — the approver decides). Pre-existing reference
      documents were grandfathered in as already-approved via the column's
      migration-time default, so nothing already relied upon suddenly
      became unattachable.
      Verified live with three real throwaway users (admin/lawyer/staff):
      staff genuinely cannot approve (403 at the API), attaching an
      unapproved document is genuinely rejected at the API regardless of
      what the UI shows (400, not just hidden from the dropdown), the
      sensitivity scanner correctly flagged a synthetic client-intake-notes
      document (real name/DOB/SIN/custody-dispute details) and correctly
      left a generic statute-style document unflagged, approval is
      per-document (approving one pending document didn't affect
      another), and a matter's attach dropdown genuinely excludes a
      still-pending document from its options. Also found and cleaned up
      unrelated leftover test artifacts from an earlier debugging session
      (an orphaned "Digest Bug Test" matter and three orphaned throwaway
      client rows) that a prior cleanup pass had missed — confirmed the
      real "ali"/"test" matters and the one real pre-existing reference
      document were untouched throughout. Audit hash chain re-verified
      valid (166 entries) after all cleanup.
- [x] Bulk ZIP/folder document import (`src/lib/bulkImport.ts`,
      `/api/matters/[id]/documents/import-zip`, `UploadDropzone.tsx`) —
      dropping a .zip on a matter's Documents tab (e.g. a disclosure
      package, or a folder someone zipped up) unpacks it and imports each
      file individually via the existing `addDocument()`, instead of
      uploading one at a time. Every entry is flattened to just its
      basename — this app doesn't organize documents into folders, and it
      doubles as a zip-slip defense: a malicious entry name like
      `../../../tmp/evil.txt` becomes the literal filename `evil.txt`,
      and the real on-disk path is always generated by `addDocument()`
      itself (UUID-prefixed, inside that matter's own upload directory),
      never derived from the zip. Directory entries and hidden/AppleDouble
      junk (`.DS_Store`, `__MACOSX/._*`) are silently skipped rather than
      imported or reported as failures. Bounded to 200 entries / 100MB per
      file / 500MB total uncompressed, rejected up front before any file
      is imported (not a partial import that stops partway). One file
      failing doesn't abort the batch — results are reported per file.
      Added the `adm-zip` dependency; `npm audit` after adding it showed
      the same 3 pre-existing high-severity findings (all in `next`'s
      `postcss`/`sharp` transitive deps, unrelated to this change) and
      nothing new from `adm-zip` itself.
      Verified live: a plain multi-file zip imported all files correctly;
      a zip with a nested folder path correctly flattened to just the
      filename; `.DS_Store`/`__MACOSX` junk was correctly skipped entirely
      (absent from results, not reported as failed); a raw path-traversal
      entry name (`../../../tmp/evil.txt`, crafted directly rather than
      via a sanitizing zip library, to test the real attack) was safely
      flattened and confirmed on the actual filesystem to land only
      inside the matter's own upload directory, not at `/tmp` or anywhere
      else; a 201-file zip was rejected up front with zero partial
      imports (document count unchanged); a corrupted file renamed to
      `.zip` failed with a clean error message, not a raw 500/stack
      trace. Confirmed matter deletion still cascades imported documents
      and their on-disk files correctly, and the audit hash chain stayed
      valid (173 entries) after cleanup.
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
- [x] Browse any folder, not just the default inbox view (`listFolders()`
      in `src/lib/emailRead.ts`, a Folder dropdown in
      `ImportEmailPanel.tsx`) — Gmail labels (via `users.labels.list`,
      passed as `labelIds` on `messages.list`), Microsoft top-level mail
      folders (via `me/mailFolders`, then `mailFolders/{id}/messages`),
      and Yahoo IMAP mailboxes (via `imapflow`'s `list()`, which — unlike
      Gmail/Graph — returns the full nested folder tree, not just the top
      level, so Yahoo actually gets deeper folder access than the other
      two for free). The default "no folder selected" option keeps the
      prior behaviour (Gmail's unfiltered view already spans every label
      except spam/trash; Microsoft's spans the whole mailbox; Yahoo
      defaults to INBOX).
      **Real bug caught before this would have shipped**: Yahoo IMAP UIDs
      are only unique *within* their own mailbox — the original
      `getYahooMessageBody()` hardcoded `INBOX`, so importing a message
      found in any other folder (once folder browsing existed) would have
      fetched by that UID against the wrong mailbox: either the wrong
      message entirely (if a message with the same UID happened to exist
      in INBOX) or a "not found" error. Fixed by threading the folder
      through end-to-end from the message list to the import call — the
      one place, out of three providers, where this actually mattered
      (Gmail/Graph message IDs are mailbox-wide unique, so they never had
      this problem).
      Verified live against the real, already-connected Yahoo account
      (read-only for folder/message listing): folder listing correctly
      returned the full real folder tree including nested folders (e.g.
      `Parent/Child`); listing messages from a non-inbox folder (Sent)
      returned real messages with the correct shape; importing a message
      from that folder into a throwaway matter correctly stored *that*
      message, confirmed by matching the imported document against the
      originally listed message (not a UID-collision mismatch from
      INBOX). Cleaned up the throwaway matter/document afterward — the
      real account's mail was only ever read, nothing was sent, deleted,
      or modified on the Yahoo side. Confirmed the audit hash chain
      stayed valid (201 entries) after cleanup.
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
      matter by default; per-matter ethical walls, deferred at the time
      this was written, shipped 2026-08-07, see "Security-audit follow-up"
      below).
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
- [x] Real RAG for chat — chunking + embeddings + cosine-similarity
      retrieval, replacing full-context injection **for chat specifically**
      (`src/lib/rag.ts`, `src/lib/chunking.ts`, `src/lib/embeddings.ts`, new
      `document_chunks` table). Deliberately *not* applied to digest/
      evidence-matrix/deadlines/drafts — those need comprehensive coverage
      of every document to summarize correctly ("summarize everything" has
      no query to retrieve against), so they still use the full-context
      `getMatterTextContext`. Chat is specifically query-driven, which is
      what makes retrieval the right fit there and nowhere else in this
      app — this is a deliberate split, not partial/incomplete work.
      No vector-search database was added: `node:sqlite` has no vector
      extension available to it, and at this app's actual scale (a solo/
      small firm's document corpus, not web-scale) brute-force cosine
      similarity in JS over stored embeddings is genuinely fast enough —
      adding pgvector or a dedicated vector DB would be overkill, not a
      correctness requirement. Embeddings via OpenAI
      (`text-embedding-3-small`, already-configured key); chunks are
      ~1500 characters with overlap, tagged with page number when the
      source has `[Page N]` markers (PDFs, from the P1 work above) so
      retrieved chunks keep their citation. Chunking is self-migrating and
      idempotent, same pattern as the encryption-at-rest migration
      earlier: the first chat message on a matter after this ships embeds
      its documents once and caches the result; every later message
      reuses the cached chunks. A document that fails to extract is
      explicitly listed to the model as unreadable rather than silently
      disappearing from context — the RAG path had briefly dropped this
      compared to the old full-context builder; caught and fixed before
      shipping. Retrieval quality (re-ranking, query expansion) isn't
      tuned in this pass — top-K is generous (15) specifically so small
      matters lose nothing versus full-context injection.
      **Bug found and fixed along the way**: while verifying this against
      the real configured OpenAI key, confirmed a second, unrelated model
      issue exists only in `gemini.ts` (already fixed in the P1 commit
      above) — OpenAI's embeddings model was fine, no changes needed there.
      Verified live end-to-end via a throwaway matter: a buried unique
      fact in an uploaded text file was correctly retrieved and cited by
      chat; a second unrelated question against the same matter correctly
      retrieved different, relevant content without re-embedding (chunk
      count unchanged); page-tagged chunking logic verified directly
      (page numbers correctly threaded through, including a page long
      enough to split into multiple chunks); a synthetic PDF failed to
      parse (a limitation of the hand-rolled test file, not the real
      pipeline — page-tagged extraction was already verified earlier
      against a copy of a real document); the unreadable-file fix
      confirmed live by asking chat to list every document, including
      ones it couldn't read. Audit hash chain confirmed intact (78 real
      rows, unbroken) after all test-data cleanup. All test data removed.

- [x] Separate Client entity (`clients` table, `src/lib/clients.ts`,
      `/clients` + `/clients/[id]`) — matters now link to a real client via
      `matters.clientId` instead of only free-text `clientName`/
      `clientEmail`. Additive, not a replacement: matters still store
      `clientName`/`clientEmail` directly since every existing feature
      (matter cards, invoices, emails) reads those fields already, and
      rewriting all of them to join through `clients` for this pass wasn't
      worth the risk. `findOrCreateClient()` reuses an existing client on
      an exact name+email match when a matter is created, so a repeat
      client's matters land under one entity instead of duplicating it —
      this is what makes the new client detail page ("all matters for
      this client") possible at all. Existing matters were backfilled
      with a client row each on first startup after this shipped.
- [x] Improved conflict-of-interest check — still not a full conflicts
      system (see caveat below), but no longer purely an exact-substring
      match: `checkConflicts()` now also runs a fuzzy name-similarity pass
      (`src/lib/fuzzyMatch.ts`, Levenshtein-based, 80% similarity
      threshold) against every existing client name, so a near-miss
      spelling ("Jon Smith" vs "John Smith") surfaces as a flagged
      possible match instead of being silently missed. The UI
      (`MatterList.tsx`) labels fuzzy matches "(similar spelling, not
      exact)" so a lawyer can tell the difference from an exact hit.
      **Still not comprehensive**: this only compares against names
      already in this app (clients + matter records) — it doesn't check
      opposing parties, witnesses, or other entities that only appear
      inside uploaded documents, which would need extracting party names
      from document text (a materially bigger feature, not attempted
      here). Verified live: exact-substring matches still work, a
      deliberately misspelled name correctly triggers a "similar-name"
      match, and creating two matters with an identical client
      name+email correctly reused the same client entity rather than
      creating a duplicate.
- [x] Client CRUD + matter-creation autocomplete (`createClient()`/
      `updateClient()`/`deleteClient()` in `src/lib/clients.ts`,
      `NewClientForm.tsx`, `ClientDetailActions.tsx`) — clients could
      previously only be created implicitly via matter creation, never
      edited, never deleted. Add/edit now exist directly on the Clients
      pages; delete is blocked with a clear count if any matter still has
      `clientId` pointing to that client — `matters.clientId` has no
      database-level foreign key (see `ensureColumn` in `src/lib/db.ts`),
      so this application-level check is the only thing standing between
      a delete and a silently orphaned reference. The new-matter form's
      "Client name" field now autocompletes against existing clients (a
      plain HTML `<datalist>`, no new dependency) and auto-fills the
      email field on an exact name match — but only when the email field
      is still empty, never overwriting something already typed.
      This autofill is load-bearing, not cosmetic: `findOrCreateClient()`
      only reuses an existing client on an exact name+email match, so
      picking a name from the datalist without the matching email
      getting filled in would silently create a duplicate client with
      the same name — confirmed live by deliberately bypassing the
      browser autofill and calling the API directly with a matching name
      but no email, which did create a second, distinct client record.
      In the real UI this doesn't happen, since selecting or typing a
      full matching name fires the autofill before submission is
      possible — but it's worth knowing the datalist and the autofill
      are a pair, not two independent conveniences.
      Verified live: create/duplicate-rejection (exact name+email
      collision correctly rejected)/update all worked via the real API;
      delete was correctly blocked while a matter referenced the client
      and succeeded immediately after that matter was removed; the
      datalist renders in the real page HTML with real client names.
      Also found and cleaned up unrelated orphaned throwaway client rows
      left over from an earlier test session. Audit hash chain
      re-verified valid (397 entries) after cleanup.
- [ ] **Malware scanning on upload — deliberately skipped, not just
      deferred.** No pure-code option exists: ClamAV would mean installing
      system-level antivirus software on the host outside this project;
      cloud scanners (VirusTotal etc.) mean sending every uploaded file's
      hash — and for full scanning, content — to a third party, a real
      confidentiality consideration for what are often privileged client
      documents. Asked the account owner directly rather than picking one
      silently; decision: skip for now. Rationale that made this the
      right default: uploaded files are only ever stored and
      text-extracted in this app, never executed, so the specific risk
      malware scanning defends against (a malicious file running) doesn't
      apply here the way it would for, say, an email attachment opened
      locally. Revisit if this app ever accepts uploads from untrusted
      third parties directly (e.g. a public intake form).
      Duplicate-document detection (SHA-256 content hash) was already
      built in an earlier pass — see "Also built" above; it wasn't
      actually part of what needed doing here.
- [x] Voice dictation on every major free-text input (chat question, matter
      notes, draft instructions, email draft instructions, email message —
      `DictateButton.tsx`, `/api/transcribe`). Deliberately record-then-
      transcribe via the existing OpenAI Whisper pipeline rather than the
      browser's built-in SpeechRecognition API — that API doesn't exist in
      Firefox and is inconsistent in Safari, while this works anywhere
      `getUserMedia` does and reuses infrastructure already configured for
      audio/video document transcription.
- [x] Smart email drafting + attachments (`ComposeEmailPanel.tsx`,
      `generateEmailDraft()` in `src/lib/claude.ts`,
      `/api/matters/[id]/email-draft`) — describe what the email should
      say, get a grounded subject+body draft (same citation discipline as
      other drafting features), review and edit before sending. Sending
      can now attach any of the matter's own uploaded documents
      (`/api/matters/[id]/send-email` accepts `documentIds`, verifies they
      belong to the matter, decrypts them via the same helper
      `textExtraction.ts` uses for reading documents, and passes them to
      nodemailer as attachments).
      Verified live via a throwaway matter: smart draft correctly grounded
      itself in an uploaded document's content (cited the source
      filename), attachment ownership validation correctly rejected a
      documentId that didn't belong to the matter. Did not live-test an
      actual send-with-attachment — that would deliver a real message via
      the real configured SMTP account, and the two things it would be
      testing (SMTP delivery, and reading/decrypting a document's bytes)
      are both already independently verified elsewhere. Audit hash chain
      confirmed intact after cleanup.
- [x] Evidence graph visualization (`EvidenceGraphView.tsx`,
      `EvidenceGraphPanel.tsx`, `/api/matters/[id]/evidence-graph`,
      `extractEvidenceGraph()` in `src/lib/claude.ts`) — a node graph of
      parties, allegations, evidence, and evidentiary gaps, with click-to-
      focus (highlights only a node's direct connections, dims the rest)
      and type checkboxes to narrow down what's shown. Confirmed with the
      account owner before building: nodes/edges represent entities and
      evidence (not a timeline or a document-relationship map), and the
      graph is built by reformatting the matter's *already-generated*
      evidence matrix rather than a fresh extraction pass over the raw
      documents — cheaper, and avoids a second, possibly-inconsistent AI
      reading of the same source material. Rendered with `@xyflow/react`
      (new dependency — confirmed it adds zero vulnerabilities of its own;
      the `npm audit` high-severity findings that show up after installing
      it are pre-existing in Next.js's own dependency tree via
      postcss/sharp, unrelated to this change, confirmed by diffing
      `package-lock.json`). Layout is a simple deterministic column-per-
      type placement, not a physics-based auto-layout — proportionate for
      the node counts a single matter's evidence matrix produces.
      Verified live via a throwaway matter: uploaded a document with two
      claims (one with supporting evidence, one with a stated evidentiary
      gap), generated a real evidence matrix, then generated the graph
      from it — parties/allegations/evidence/gaps and their connections
      were all correct, zero dangling edge references. Audit hash chain
      confirmed intact after cleanup.
      Follow-up fixes after initial feedback: node text was unreadable
      (no explicit text color set against the light node backgrounds —
      inherited color could be invisible depending on theme); fixed with
      explicit dark text plus larger/bolder labels and readable edge-label
      backgrounds. "Open in new tab" used `window.open()`, which popup
      blockers can silently swallow with no visible feedback — replaced
      with a real `<a target="_blank">` link (never popup-blocked, since
      it's a normal navigation, not a script-initiated window). The graph
      canvas is dark-mode aware (`dark:bg-neutral-900`) with a
      dark-appropriate dot-grid color; node backgrounds stay fixed light
      pastels with dark text in both themes, which is what actually keeps
      them readable — the canvas going dark doesn't affect node contrast.
      Graph data for the new-tab view hands off via `localStorage`.
      Second round of feedback: the new tab opened correctly (the `<a
      target="_blank">` fix worked) but showed the *entire app* around the
      graph — sidebar, matter header, matter tabs — not just the graph.
      Root cause: the page lived at `matters/[id]/evidence-graph-view`,
      nested inside both the matter layout (which adds the header/tabs)
      and the root layout (which adds the app-wide sidebar/top bar) —
      layouts in the Next.js App Router are inherited by nested routes
      regardless of what the page itself renders. Fixed by moving it to
      its own top-level route, `evidence-graph/[id]`, outside the
      `matters/` segment entirely, and adding a shared
      `isChromelessRoute()` check (`src/lib/chromelessRoutes.ts`) so
      `ConditionalNav`/`TopUtilityBar` also hide themselves for this
      route, the same way they already did for `/login`. Verified live:
      diffed the raw HTML of the graph route against a normal matter page
      with the same authenticated session — zero sidebar/top-bar markup
      on the graph route, both present on the normal page.
      Third round: the chromeless route worked, but the new tab then
      showed "No graph data found" — the original `sessionStorage`
      handoff (see above, now corrected) was wrong. The spec behavior
      it relied on (a new same-origin browsing context inheriting
      `sessionStorage`) applies specifically to browsing contexts created
      *by a script* (`window.open()`) — it explicitly does not apply to
      "following a link," which is exactly what the `<a target="_blank">`
      fix for the popup-blocker issue switched to. Fixed by switching the
      handoff from `sessionStorage` to `localStorage`, which is shared
      across all same-origin tabs unconditionally, regardless of how the
      tab was opened — the correct mechanism for this case from the
      start.
- [x] Backup & restore, with scheduling (`src/lib/backup.ts`,
      `/api/backup*`, Settings > Backup, `BackupManager.tsx`) — one-click
      backup of the entire `data/` directory into a `.tar.gz` under a
      sibling `backups/` folder (last 10 kept, older ones pruned
      automatically), downloadable, deletable, and restorable from the
      Settings UI. The SQLite file is snapshotted via `VACUUM INTO`
      rather than tarring `app.db` directly — a consistent single-file
      snapshot regardless of WAL state, not a copy that could land
      mid-write. Restore requires typing "RESTORE" to confirm, moves the
      *current* `data/` directory aside (to `data.before-restore-{time}`)
      rather than deleting it — nothing is ever destroyed by a restore,
      even a restore you didn't mean to do — and responds telling you the
      app must be restarted immediately, since the running process
      already has the old database file open and can't safely have it
      swapped out from underneath it. Scheduled backups reuse the exact
      unattended-cron pattern already established for legislation
      watches: an admin-only page shows a bearer-token command to wire
      into an OS-level scheduled task (cron on macOS/Linux, Task
      Scheduler on Windows) — this app still has no built-in background
      scheduler, consistent with that earlier decision.
      **Not backed up**: the AES encryption master key. On macOS it lives
      in the Keychain, which isn't part of `data/` and isn't exportable
      by this feature — documented in `docs/INSTALLATION.md` as something
      to back up separately (Keychain on macOS, a key file at
      `~/.lawyer-assistant/masterkey` on Windows/Linux). A restore without
      the matching key can't decrypt the restored secrets/documents.
      Verified live: created/listed/downloaded/deleted a real backup via
      the actual admin UI; confirmed a path-traversal filename is
      rejected; confirmed non-admins get 403; confirmed the scheduled
      endpoint accepts the real cron secret and rejects a wrong or missing
      one. Did **not** test restore against the real `data/` directory —
      restore is genuinely destructive to whatever's currently in place
      (even with the move-aside safety net) and testing it live risked
      the two real matters for no real benefit. Instead verified the
      complete backup→mutate→restore cycle in full isolation, running the
      actual `backup.ts` code against a throwaway fake project directory
      (via `process.chdir`, never touching the real `data/`): confirmed
      the pre-backup state was correctly restored, confirmed data written
      *after* the backup was correctly excluded from the restore, and
      confirmed that data was preserved (not lost) in the moved-aside
      directory rather than being silently discarded.
- [x] Defence strategy memo — a new drafting type (`DRAFT_TYPES` in
      `src/lib/types.ts`), reusing all of the existing drafting
      infrastructure (dictation, page citations, storage, UI) rather than
      building a separate feature. Gets its own tailored system prompt
      (`DEFENCE_STRATEGY_SYSTEM` in `src/lib/claude.ts`) instead of the
      generic drafting prompt, since a defence strategy memo needs a
      structurally different output: opposing-case summary, weaknesses in
      that case, viable defence theories *ranked by how well the
      documents actually support each one*, procedural/evidentiary issues
      worth raising, and recommended next investigative steps. Same
      honesty discipline as every other AI feature here — cites sources,
      says "Not stated in the provided documents" rather than inventing
      supporting facts, explicitly does not predict an outcome. Verified
      live via a throwaway matter with a short fact pattern (weak
      identification evidence, no physical evidence, an unobtained
      original video): output correctly identified and ranked the
      identification-weakness theory as strongest, correctly flagged the
      alibi theory as unsupported rather than inventing one, and gave
      concrete disclosure requests as next steps. Audit hash chain
      confirmed intact after cleanup.
- [x] Real markdown rendering + PDF export for every AI-generated
      document (`MarkdownContent.tsx`, `ExportPdfButton.tsx`,
      `/export/pdf`). Digests, evidence matrices, all drafting types, chat
      answers, and independent reviews previously rendered as raw
      `whitespace-pre-wrap` text — literal `##`/`-`/`**` characters
      visible instead of actual headings/lists/bold. `MarkdownContent`
      (built on `react-markdown`, new dependency — confirmed zero new
      vulnerabilities the same way as `@xyflow/react`/`tar` above) maps
      the markdown subset these prompts actually produce onto the app's
      existing design tokens rather than pulling in a full typography
      plugin for a handful of element types.
      PDF export reuses the chromeless-route + `localStorage`-handoff
      pattern from the evidence graph (lesson already learned there:
      `localStorage`, not `sessionStorage`, and a real `<a
      target="_blank">`, not `window.open()`) to open a clean,
      print-formatted view in a new tab. "Export" is the browser's native
      print dialog set to "Save as PDF" — no PDF-generation library
      needed, and print CSS (`print:hidden` on the controls) gives full
      control over the output without a second rendering pipeline to
      keep in sync with `MarkdownContent`.
      Verified live via a throwaway matter: generated a real digest and
      confirmed the rendered page has actual `<h2>` tags (6 found) and
      zero literal `##` in the visible HTML (the one match found was
      inside Next.js's RSC hydration payload, not visible text — checked
      the surrounding context to confirm); confirmed the Export PDF
      button renders; confirmed `/export/pdf` has zero sidebar/top-bar
      markup, matching the evidence graph's chromeless-route pattern.
      Audit hash chain confirmed intact after cleanup.
- [x] **Bug fix — AI generation silently saving empty content on real,
      large matters.** Reported live: the matter digest showed nothing,
      and independent review then failed with "sourceType
      (digest|evidence_matrix|chat_message), sourceId, and content are
      required" — both symptoms traced to the same root cause.
      `completeAnthropic()` and `completeWithOpenAI()` (`src/lib/claude.ts`,
      `src/lib/openaiText.ts`) both returned `?? ""` when a provider's
      response had no visible text (observed on a real matter with a
      large document set — likely reasoning/internal tokens consuming the
      whole output budget before any visible answer text). Their sibling
      structured-output functions (`completeJSONAnthropic`,
      `completeJSONWithOpenAI`) already correctly threw in this case; the
      plain-text path was missed. Returning `""` instead of throwing meant
      `forEachConfiguredProvider` saw a "successful" (non-throwing) result
      and never tried the next provider — the empty string then got
      persisted as a real digest by `addDigest()`, and an empty string is
      falsy in JS, so the independent-review endpoint's `!content` guard
      correctly rejected it afterward — a second, correct error hiding the
      real, silent first one.
      Fixed by making both functions throw the same
      "returned an empty response" error their JSON siblings already used,
      so an empty completion now correctly triggers provider fallback or
      surfaces a real error, instead of a false success.
      Found and fixed against the actual real matter that triggered it:
      confirmed three existing digest rows for the real "ali" matter had
      `length(content) = 0` (two from today, one from 2026-08-02 — a
      recurring issue, not a one-off), removed those broken rows (kept the
      two genuinely good ones), then regenerated the digest live against
      the real matter post-fix — 5156 characters of real, correct content
      instead of empty, and a follow-up independent-review request on
      that same content succeeded where it previously would have failed
      validation. The regenerated digest and its independent review are
      genuinely good real output, not test data, so they were left in
      place rather than cleaned up. Audit hash chain confirmed intact.
- [x] **Bug fix — evidence graph failing with "Unterminated string in JSON
      at position N" on a real matter.** Same underlying category as the
      empty-digest bug above (insufficient `maxTokens` for a real,
      data-rich matter), different symptom: instead of an empty response,
      `extractEvidenceGraph`'s response got cut off *mid-JSON-string*,
      producing a technically non-empty but unparseable response — the
      raw `JSON.parse` `SyntaxError` was surfacing straight to the user
      as-is, a meaningless message for a lawyer to see. Fixed two ways:
      (1) raised `maxTokens` across every generation function in
      `claude.ts` — evidence graph specifically to 8192 (graph JSON has
      real per-node/edge overhead beyond just prose length), digest/
      evidence-matrix/drafts to 4096, deadlines/email-draft to 2048, chat
      to an explicit 2048 (previously relied on `complete()`'s bare 1024
      default) — none of these were sized for a genuinely large real
      matter, only for the small test-sized ones exercised during
      development; (2) wrapped the `JSON.parse` call in both
      `completeJSONAnthropic` and `completeJSONWithOpenAI` so a parse
      failure now throws a clear, actionable message instead of a raw
      technical one, as a safety net for if a matter is ever large enough
      to hit even the new, larger budget.
      Verified against the real "ali" matter's real, existing evidence
      matrix (4330 characters) post-fix: 13 nodes, 15 edges, zero dangling
      edge references — succeeded cleanly where it previously failed to
      parse. Audit hash chain confirmed intact after cleanup.
- [x] Defence graph — the same node-graph visualization as the evidence
      graph, built from the most recent **defence strategy memo** instead
      of the evidence matrix (`DefenceGraphPanel.tsx`,
      `/api/matters/[id]/defence-graph`, `extractDefenceGraph()` in
      `src/lib/claude.ts`). Nodes: opposing-case weaknesses, defence
      theories, evidentiary/procedural issues, next investigative steps.
      Edges: weakness→theory ("supports"), theory→issue ("raises"),
      theory→step and issue→step ("needs"/"requires"). Same
      reformat-an-existing-document approach as the evidence graph — no
      fresh extraction pass over raw documents. Shown on the matter's
      Drafts page once at least one defence strategy memo exists.
      The graph-rendering component was generalized from
      evidence-graph-only (`EvidenceGraphView.tsx`, hardcoded to 4 fixed
      node types) into a reusable `GraphView.tsx` parameterized by a
      `typeConfig` (`src/lib/graphTypeConfigs.ts`) rather than duplicating
      ~160 lines of layout/interaction logic for a second graph kind. The
      "open in new tab" fullscreen route also became generic —
      `/evidence-graph/[id]` is now `/graph-view/[id]?kind=evidence|
      defence` — reading `{graph}` from a kind-scoped localStorage key
      (`graphView:{matterId}:{kind}`) so both kinds can coexist for the
      same matter without overwriting each other.
      Verified live against the real "ali" matter's actual, substantial
      defence strategy memo (18,939 characters — the account owner had
      already been using this feature live, concurrently with this work):
      32 nodes, 32 edges, all four node types present, zero dangling
      references. Regression-tested the evidence graph through the same
      refactored `GraphView` afterward (still 18 nodes, no change in
      behavior) and confirmed the generic `/graph-view` route stays
      chromeless for both kinds.
- [x] **Second bug found the same way — and a design flaw in the audit
      log's own tamper-evidence feature, found while investigating it.**
      Live-testing the defence graph above surfaced a leftover empty
      "Demand letter" draft (same empty-response bug as the digest/graph
      fixes, from before those fixes shipped — removed). Cleaning up that
      test round's temp admin account then showed the audit hash chain
      had broken *for real*, not from test cleanup this time: two gaps
      (rowids 68-69 and 72-75, 6 rows, dated 2026-08-02/03).
      Root cause: `deleteMatter()` (`src/lib/matters.ts`) cascaded a
      `DELETE FROM audit_log WHERE matterId = ?` on every matter deletion
      — but `audit_log` is hash-chained *globally*, not per matter, so
      deleting that matter's rows out of the middle of the global
      sequence broke the chain for every row inserted after them. This
      had been true since the hash-chain feature shipped; it just hadn't
      been exercised by a matter deletion with interleaved concurrent
      activity until now. Fixed by no longer deleting audit rows on
      matter deletion at all — an audit trail should survive deletion of
      what it audited (standard compliance practice, not just a hash-chain
      fix) — and by cleaning up an unrelated small leak found in the same
      function while there: `document_chunks` for a deleted matter's
      documents were never removed.
      The harder question: once broken, `verifyAuditLogIntegrity()` would
      report "broken" at that same historical point *forever*, on every
      future check — useless for telling a real new tampering event apart
      from this one already-explained, now-fixed bug. Added
      `reanchorAuditLogIntegrity()` — recomputes every row's hash over
      whatever rows currently exist (healing the gap) and records a
      permanent, visible `audit_chain_reanchored` event stating *why*,
      exposed via an admin-only UI action (`AuditIntegrityCheck.tsx`) that
      requires typing a reason before it will run, since that reason is
      the only record of why a break was accepted rather than
      investigated as tampering. This is a real trust trade-off, made
      deliberately and transparently rather than either left broken
      forever or silently patched: re-anchoring makes past, explained
      damage stop crying wolf, at the cost of that damage no longer being
      independently provable from the chain alone — the explanation lives
      in the event itself, in git history, and here instead.
      Executed for real against the actual broken chain (not a test):
      confirmed broken (122 entries, break at a specific entry ID),
      re-anchored with a full explanation of the root cause recorded as
      the reason, re-verified valid (123 entries, including the
      re-anchor event itself). Confirmed the temp admin account used to
      run this could be removed afterward without touching a single
      audit row — proof the fixed `deleteMatter()`/cleanup path no longer
      has this failure mode.
- [x] Translation on every AI-generated output surface (`TranslateButton.tsx`,
      `/api/translate`, `translateText()` in `src/lib/claude.ts`) —
      digest, evidence matrix, drafts (including the defence strategy
      memo), chat answers, independent reviews, and the smart email
      draft. French first in the language list, given this app's
      Canadian legal context, plus Spanish/Mandarin/Punjabi/Arabic/
      Tagalog and a free-text "Other". Not matter-specific — pure
      text-in/text-out via the already-configured AI provider, so no new
      external translation service was added.
      Two different UX patterns depending on whether the content is
      read-only or editable: for read-only generated content
      (digest/matrix/drafts/chat/reviews), translation appears as an
      additive block below the original — `TranslateButton.tsx`,
      rendered through `MarkdownContent` since legal text structure
      (headings/lists) is worth preserving in the translation too. For
      the smart email draft body, which is an editable field you're
      about to send, translation replaces the textarea content in place
      instead — a separate read-only block wouldn't make sense for
      something you need to edit and send.
      The prompt explicitly preserves markdown structure and leaves
      parenthetical source citations (e.g. "(file.pdf, p. 4)") untouched
      — translating the filename inside a citation would break its
      ability to be checked against the matter's real documents.
      Verified live: a synthetic legal snippet with two page citations
      translated correctly into French, with both citations preserved
      byte-for-byte and markdown headings intact. Confirmed the audit
      hash chain stayed valid (147 entries, real ongoing activity) after
      cleanup.
- [x] Settings > Translation page (`/settings/translation`,
      `src/components/TranslationLanguageForm.tsx`,
      `getDefaultTranslationLanguage()`/`setDefaultTranslationLanguage()` in
      `src/lib/settings.ts`, `/api/settings/translation`) — the initial
      shipped translation feature had a hardcoded "French" default with no
      way to change it and no visible settings entry, which the user
      correctly flagged as missing. Treated as a personal-preference
      setting (like Appearance), not a firm-wide resource, so it's open to
      every user, not admin-gated — `src/proxy.ts`'s
      `NON_ADMIN_SETTINGS_PAGES`/`isAdminOnlyApi` exceptions cover both the
      page and the API route.
      Every `TranslateButton` (used across digest/matrix/drafts/chat/
      reviews) and the smart-email-draft's translate control now fetch
      this configured default and pre-select it, instead of always
      defaulting to French: `TranslateButton.tsx` fetches lazily on first
      "Translate" click (guarded so it only fetches once per mount);
      `ComposeEmailPanel.tsx` fetches once on mount via `useEffect`. Both
      fall back silently to the built-in French default if the fetch
      fails, and both fold a configured language that isn't in their
      hardcoded preset list into the dropdown (as "Other" + custom text
      for `TranslateButton`, prepended to the list for
      `ComposeEmailPanel`) rather than silently ignoring it.
      Verified live via a throwaway admin user: default reads back as
      "French", changing it to "Punjabi" round-trips correctly through
      GET/POST, restored to "French" afterward since this is shared
      app-wide config, not per-user. Confirmed `/api/settings/translation`
      is unreachable without a valid session (401), same as every other
      settings route — gated by `src/proxy.ts`, not the route handler
      itself. Audit hash chain re-verified valid (147 entries) after
      cleanup.
- [x] **PII masking before any AI provider call** (`src/lib/piiMask.ts`,
      `getPiiMaskingSettings()`/`setPiiMaskingSettings()` in
      `src/lib/settings.ts`, `/settings/privacy`) — detects and masks
      SIN/SSN/credit card numbers (and, per the account owner's explicit
      choice, phone numbers and email addresses too) out of a matter's
      documents/notes before that text is sent to Anthropic, OpenAI, or
      Google Gemini for *any* feature. On by default — the account
      owner's deliberate choice, favouring safety over the real cost that
      a draft needing to state an actual number will only show a
      placeholder (`[REDACTED:SIN]` etc.) unless masking is turned off
      first; each identifier type can be toggled independently in
      Settings > Privacy (admin-only, firm-wide — not a personal
      preference like Appearance/Translation).
      Detection is regex + checksum based, not an AI call itself (masking
      can't depend on the thing it's protecting against): credit card
      numbers and Canadian SINs are validated via the Luhn algorithm
      (SIN's real check-digit algorithm, not a made-up heuristic) before
      being masked, which is what keeps false positives on ordinary
      file/docket numbers and dollar amounts low — an unseparated 9-digit
      run is deliberately left alone even if Luhn-valid, since that
      format is too common in reference numbers to safely treat as a SIN
      without the 3-3-3 grouping SINs are actually written with.
      Wired into exactly three choke points so every AI feature is
      covered without touching each one individually: `getMatterTextContext()`
      and `getMatterChatContext()` in `src/lib/matters.ts` (covers
      digest, evidence matrix, deadlines, one-shot drafts, smart email
      draft, independent review, and chat) and the drafting agent's
      search-tool results in `src/lib/draftingAgent.ts` (the one AI-bound
      text path that doesn't go through those two functions).
      Verified with 13 deterministic unit cases (a real Luhn-valid SIN
      correctly masked; a same-format but checksum-invalid number and a
      bare unseparated 9-digit run correctly left alone; a real test
      credit card number masked in both spaced and unspaced form; a
      non-Luhn 16-digit number left alone; SSN/phone/email all masked;
      ordinary legal text — file numbers, paragraph references, dates,
      dollar amounts — produced zero false positives; multiple identifier
      types in one string all masked independently without interfering
      with each other) — then, more importantly, verified live end-to-end
      against a real Anthropic call: uploaded a document containing a
      real Luhn-valid SIN and a real test credit card number, generated a
      real digest, and confirmed neither the real SIN nor the real card
      number appeared anywhere in the AI's output (it only ever saw the
      `[REDACTED:...]` placeholders). Confirmed `/settings/privacy` and
      `/api/settings/privacy` are unreachable by a non-admin (403) and
      require a session at all (401), same as every other settings
      route. Audit hash chain re-verified valid (759 entries) after
      cleanup.

- [x] **Automatic backups + cloud storage (2026-08-09/10)** — `src/instrumentation.ts` +
      `src/lib/backupScheduler.ts` run an in-process scheduler (checks every
      5 minutes whether the configured interval has elapsed) so hourly (or
      any N-hour) local backups no longer require an OS-level cron job —
      Settings > Backup still documents the external-cron endpoint as an
      optional alternative for anyone who prefers it. Cloud upload supports
      three provider families, selectable in the same panel:
      - S3-compatible (`src/lib/cloudBackup.ts`, `@aws-sdk/client-s3`) — a
        custom `endpoint` + `forcePathStyle` covers AWS S3, Cloudflare R2,
        Backblaze B2, Wasabi, DigitalOcean Spaces, or self-hosted MinIO with
        no OAuth needed, just an access key/secret. This is the
        works-today path — verified live against a real S3-compatible HTTP
        server (PUT/DELETE/List all round-tripped correctly).
      - Google Drive and OneDrive (`src/lib/cloudDriveBackup.ts`) — real
        OAuth (Google Drive resumable-upload API, Microsoft Graph
        `createUploadSession` chunked upload — both verified against the
        providers' current docs via WebFetch, not assumed from training
        data), reusing the SAME Client ID/Secret already entered in
        Settings > Integrations for the Gmail/Outlook email integration
        (one app registration, requested with an additional Drive/Files
        scope) rather than asking for a second app registration. **Not
        usable yet** — same external blocker as decision #6 below: needs
        that Microsoft/Google app's scope widened to include
        `Files.ReadWrite` / `drive.file`, then "Connect" in Settings >
        Backup. Google Drive only ever touches a dedicated "Lawyer
        Assistant Backups" folder it creates itself (`drive.file` scope
        can't see anything else in the account's Drive); OneDrive uploads
        into a dedicated `LawyerAssistantBackups` folder the same way.
      All three providers' access/refresh tokens and credentials are
      encrypted at rest via the existing `crypto.ts` master-key mechanism —
      unlike the pre-existing email integration's `email_accounts` table,
      which still stores its OAuth tokens in plaintext (a gap worth closing
      separately, not introduced by this feature).
- [x] **Cloud backup follow-up: unblocked, rclone provider, setup wizard,
      activity-triggered backups (2026-08-10)** — the Drive/OneDrive
      "not usable yet" blocker above is resolved for OneDrive: the OAuth
      connect flow now reuses the SAME redirect URI already registered for
      the email integration (`/api/integrations/[provider]/callback`,
      which now branches on whether `state` matches an email or a
      cloud-backup OAuth attempt), so no second redirect URI needs
      registering — only the Files.ReadWrite/drive.file scope needs adding
      to an existing app. Also added, given the account owner doesn't want
      to require an Azure/Google app registration at all:
      - **`rclone` as a fourth provider** (`src/lib/rcloneBackup.ts`,
        `src/lib/rcloneInstall.ts`) — rclone ships its own already-registered
        Microsoft/Google app, so this is the only path needing zero app
        registration. Settings > Backup can install rclone itself
        (Homebrew on macOS/Linux, winget on Windows) if it's missing.
      - **An in-app setup wizard** (`src/lib/rcloneWizard.ts`,
        `RcloneWizard.tsx`) driving rclone's own `config create/update
        --non-interactive` JSON question/answer protocol (verified live
        against a real rclone install, not assumed from docs) — auto-
        answers only two specific, verified-safe questions
        (use-browser=yes, OneDrive connection-type=onedrive) and surfaces
        anything else as a real choice. **Real bug caught by live
        testing**: an early version also auto-matched any option whose
        label contained "personal", which silently picked the wrong
        Microsoft drive on an account that had several
        Microsoft-managed storage resources (Bundles, ODCMetadataArchive,
        etc.) all *also* labelled "(personal)" alongside the actual
        OneDrive — every access then failed with "unable to get drive_id
        and drive_type" since the real drive was never actually selected.
        Fixed by replacing the heuristic with an explicit allowlist of
        only the two verified question names; the drive picker now always
        surfaces to the user, with whichever option is actually named
        "OneDrive" highlighted. Verified the fix live end-to-end: real
        OAuth connection, real drive selection, real file
        upload/list/delete against the account's actual OneDrive.
      - **Debounced activity-triggered backups** (`src/proxy.ts` marks the
        app "dirty" on any mutating `/api/*` request, excluding the
        backup/auth/settings-backup routes themselves to avoid a feedback
        loop) — backs up shortly after real changes go quiet (default
        2 min debounce), never more often than a cooldown floor (default
        10 min), independent of and additive to the fixed-interval
        schedule. Built instead of literally "back up after every change"
        (which the account owner initially asked for) after flagging that
        a full VACUUM+tar+cloud-upload on every single write would
        meaningfully slow the app and risk provider rate limits — the
        account owner chose the debounced approach once that tradeoff was
        explained.

## Dependency notes

- **`react-markdown`** — renders AI-generated markdown content. Adds zero
  vulnerabilities of its own per `npm audit` (same before/after
  `package-lock.json` diff check as the other additions below).
- **`tar`** — creates/extracts the `.tar.gz` archives for backup/restore.
  Adds zero vulnerabilities of its own per `npm audit` (confirmed the same
  way as `@xyflow/react` above: diffing `package-lock.json` before/after
  showed no change to the pre-existing high-severity findings, which come
  from Next.js's own dependency tree).
- **`xlsx` (SheetJS)** is installed from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
  (pinned exact version), not the npm registry package of the same name. The
  npm-published `xlsx` build has unpatched high-severity prototype-pollution
  and ReDoS advisories; SheetJS only ships fixes through their own CDN.
  `exceljs` was evaluated as an alternative and rejected — it pulls in more
  vulnerable transitive dependencies, not fewer. Re-check this decision if a
  cleaner-audited spreadsheet library becomes available.
- **`@xyflow/react`** — node-graph rendering for the evidence graph feature.
  Adds zero vulnerabilities of its own per `npm audit`; the high-severity
  findings visible after installing it are pre-existing in Next.js's own
  dependency tree (postcss/sharp), confirmed unrelated by diffing
  `package-lock.json` before/after.
- **`adm-zip`** — extracts bulk-import `.zip` uploads. Adds zero
  vulnerabilities of its own per `npm audit`; the 3 high-severity findings
  present after installing it are the same pre-existing Next.js
  `postcss`/`sharp` findings as above, confirmed by diffing
  `package-lock.json` before/after.
- **`qrcode`** (+ `@types/qrcode`) — renders the MFA enrollment QR code
  server-side to a PNG data URI. Adds zero vulnerabilities of its own per
  `npm audit`, confirmed by diffing `npm audit --json` output before/after
  install (4 pre-existing high-severity findings, unchanged).

## Security-audit follow-up (2026-08-07)

Four items picked off a self-review against the original architecture vision
doc's security/ingestion requirements. All verified live against the real
SQLite DB (throwaway users/matters, cleaned up after) and a running dev
server, not just build/lint.

- [x] **Per-matter ethical walls** (`matters.ethicalWall`, `src/lib/matterAccess.ts`,
      enforced centrally in `src/proxy.ts`) — resolves the "everyone sees
      every matter" limitation noted below and at line ~1283. Off by default
      (unchanged shared-visibility behaviour); turning it on for a specific
      matter restricts it to that matter's `matter_team` members plus admins.
      Enforced at the route level (every `/matters/[id]/*` page and
      `/api/matters/[id]/*` API route redirects/403s a non-member), and the
      matter is also filtered out of the matters list, dashboard, global
      search, related-matter search, and client detail pages for anyone
      without access — a wall that only blocked direct navigation but still
      leaked the matter's existence through search would defeat the point.
      Conflict-of-interest checking (`checkConflicts`) deliberately still
      searches across *all* matters including walled ones — real
      conflict-check systems intentionally cross wall boundaries for exactly
      this reason, so a lawyer still gets warned about a possible conflict
      even if they can't see the walled matter's details. The toggle itself
      isn't admin-restricted (matches legal hold/classification precedent);
      revisit if that's too permissive in practice.
- [x] **TOTP-based MFA** (`src/lib/totp.ts`, `src/lib/auth.ts`) — RFC 6238
      implemented directly on `node:crypto` rather than a dependency (the
      HOTP core was verified against the official RFC 4226 Appendix D test
      vectors before shipping). Login becomes two-step once enabled: a
      short-lived, single-use `pendingToken` is issued after the password
      checks out, and a session is only created after
      `/api/auth/mfa` accepts a code against it. Backup codes (8, one-time,
      hashed at rest like passwords) cover losing the authenticator device.
      QR-code enrollment (`qrcode` package, see above) renders server-side
      so the `otpauth://` URI — which embeds the secret — never has to be
      typed or leave the app's own response.
- [x] **Near-duplicate document detection** (`checkNearDuplicateOnUpload`,
      `annotateNearDuplicates` in `src/lib/matters.ts`) — reuses the
      existing per-document centroid-embedding infrastructure behind
      "Similar documents" rather than building a second similarity system;
      flags ≥96% cosine similarity between two documents in the same matter
      as a near-duplicate (a re-scan, a reformatted copy) on top of the
      pre-existing exact-hash duplicate check, which only ever caught
      byte-for-byte identical files.
- [x] **Failed-document extraction review queue** (`src/lib/extractionStatus.ts`)
      — extraction attempts now persist status (`ok`/`failed`/`unsupported`)
      and the real error message per document/reference document, instead of
      the previous behaviour (both in `getMatterTextContext` and the RAG
      chunking path) of silently swallowing the error into a generic
      placeholder string. A failed document shows a badge with the real
      error on hover and a "Retry" button on the matter Overview page.
- [x] **Privacy Impact Assessment and Incident Response Runbook**
      ([`docs/PRIVACY_IMPACT_ASSESSMENT.md`](./PRIVACY_IMPACT_ASSESSMENT.md),
      [`docs/INCIDENT_RESPONSE_RUNBOOK.md`](./INCIDENT_RESPONSE_RUNBOOK.md)) —
      real documents, not code: what personal information this system collects
      and where it goes (including the honest gaps — no penetration test, no
      vendor security assessments, no enforced data residency, matter
      classification doesn't yet gate AI provider choice), and concrete,
      codebase-specific steps for account compromise, malware, unauthorized
      data exposure, and backup/audit-log recovery. Not a substitute for a
      real penetration test, vendor security assessments, or a formal data
      residency attestation — those need an external party or a contractual
      answer this codebase can't produce on its own.
- [x] **Two more audit-chain re-anchors, one of them corrected after the
      fact.** First (2026-08-08): rows created by a throwaway test admin
      account (live-verifying DLP-lite export rate limiting/alerting) were
      deleted as part of test cleanup, breaking the chain again the same
      way the 2026-08-05 incident above did — re-anchored with a reason
      documenting exactly that. Second, more involved case (gap reported
      2026-08-08, investigated and fixed 2026-08-11): `audit_log` rowids
      1275–1276 were found missing entirely (entry `f18b1110-...` sits
      right after the gap). Ruled out the already-fixed `deleteMatter()`
      bug (no matching pattern, no orphaned child-table rows) and any
      currently-active delete path (grepped the codebase — nothing deletes
      from `audit_log` anymore); the gap's timestamp window matches commit
      `b6dcb6a`'s performance-tuning work and the same benign
      test-cleanup pattern as the first case above, just never re-anchored
      that time. Can't be proven conclusively — the deleted rows'
      content is gone — but nothing pointed toward tampering either. A
      re-anchor had already run for this gap on 2026-08-10, but with the
      reason left as the placeholder `"test"` rather than an actual
      explanation, defeating the point of requiring a reason at all;
      corrected with a second re-anchor recording the real investigation
      above (chain confirmed valid again afterward, 1334 entries).

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
   **Also now blocks Google Drive / OneDrive cloud backup** (see "Also
   built" above) — same app registration, just needs the Drive
   (`drive.file`) or Files.ReadWrite scope added once the app exists.
   S3-compatible cloud backup doesn't need any of this and works today.
7. ~~**Multi-user access model**~~ — **Resolved 2026-08-04.** Confirmed:
   every user sees every matter by default (roles gate admin/settings
   actions); admin creates accounts manually with a temporary password
   (no self-registration/invite-link surface). First admin account:
   ali.salamat@cortexhq.ai / Ali Salamat, migrated from the pre-existing
   single password (same password, no reset needed). ~~Per-matter ethical
   walls~~ — **resolved 2026-08-07**, see "Security-audit follow-up" above.
