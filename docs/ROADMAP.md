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

## Phase 1.5 — Make the data layer real (next)

The local JSON file (`data/db.json`) works but has no transactions, no concurrent-write
safety, and no query capability beyond "load everything into memory." Before adding
more features on top of it:

- [ ] Migrate `src/lib/matters.ts` to `node:sqlite` (same async function signatures —
      `listMatters`, `getMatter`, `createMatter`, etc. — so nothing above the data
      layer changes)
- [ ] Add basic auth: a single-user password gate (session cookie), since this will
      eventually hold real client data. Not Entra ID/SSO — that's a firm-scale
      decision, not a default.
- [ ] Add an audit log table (who/what/when for create/update/delete actions) — the
      doc's "immutable audit logging" requirement, scoped down to something a local
      SQLite table can actually do.

## Phase 2 — Legal research (needs an external decision before most of it can start)

- [ ] Matter search/filter on the matters list (no external dependency — can build now)
- [ ] Citation formatting/verification pass on chat answers (partially done — Claude
      cites filenames; a real verification step needs deterministic parsing, doable
      without new accounts)
- [ ] CanLII / Justice Laws integration — **blocked on API access**. CanLII's API
      requires a developer agreement; flag to user when ready to pursue.
- [ ] Case-law citation lookup and "note-up" (subsequent treatment) — **blocked on
      a licensed source** (CanLII, Westlaw, or similar)

## Phase 3 — Evidence and Crown analysis

- [ ] Matter digest / executive summary generation (buildable now, on top of
      whatever documents are uploaded — no new accounts needed)
- [ ] Elements-of-offence matrix, evidence-to-element mapping (buildable now as a
      structured-output prompt over uploaded docs)
- [ ] Independent second-model review — **needs a second model provider account**
      (Anthropic explicitly recommends a *different* provider family for this to be
      meaningful, per the multi-model design)

## Phase 4 — Controlled agents

- [ ] Deadline-monitoring agent (buildable now — parse dates out of matter docs,
      surface on the dashboard)
- [ ] Drafting agent (memo/letter templates — buildable now)
- [ ] New-law monitoring agent — **blocked on a legal-source API** (same blocker as
      Phase 2's CanLII integration)

## Phase 5 — Institutional learning

- [ ] Lawyer approval/correction workflow on chat answers (buildable now — a
      thumbs up/down + edit on each answer, stored for later review)
- [ ] Everything past that (precedent library, formal eval sets, fine-tuning) is
      premature before there's real usage data to learn from

## Decisions that need the account owner, not a default

These are genuinely blocked on choices only you can make — flagging them here so
they're not silently skipped or silently guessed:

1. **Audio/video transcription** — paid API (AssemblyAI/Deepgram/Whisper API) vs.
   local Whisper model. Neither is free-and-easy; pick one when needed.
2. **CanLII/legal-research API access** — requires signing up and getting a key.
3. **A second AI provider** for independent review (Phase 3) — which provider, and
   is the cost justified yet at this stage of usage.
4. **Anthropic account billing** — chat has been blocked on insufficient credit
   balance since Phase 2 was built; resolve when ready to actually use chat.
5. **Production hosting**, if this ever needs to run somewhere other than one
   local machine — changes the database and auth answers above.
