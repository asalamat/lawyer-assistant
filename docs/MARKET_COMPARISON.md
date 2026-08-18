# Market comparison (2026)

A snapshot comparison against real competitors, researched live (not from
training-data assumptions) and cross-checked against this app's actual
codebase before being written down. See the "What's missing" section below
for the honest gap list this comparison produced.

**Updated August 2026** — the original comparison (below, first written in
`92cf8e2`) listed five "real gaps" against every full-suite competitor.
Four of those five have since been closed (payments, accounting sync, SMS,
and a partial close on mobile via PWA+push). This revision marks what
changed, re-verifies the claims that could have shifted since, and adds
capability rows for what was actually built.

## Feature comparison snapshot

| Capability | Lawyer Assistant | Clio/MyCase/PracticePanther/Smokeball/CosmoLex | Filevine | Everlaw/Logikcull/Reveal | Tabs3/HoudiniEsq |
|---|---|---|---|---|---|
| Matters, billing, trust accounting | ✅ | ✅ | ✅ | — | ✅ |
| Financial reporting (AR aging, retainer alerts, profitability) | ✅ | ✅ | ✅ | — | ✅ |
| AI digests/evidence matrices/contradictions | ✅ | partial (bolt-on AI) | ✅ (deeper) | — | ❌ |
| AI evidence-connections graph | ✅ | ❌ | partial (case timeline) | — | ❌ |
| Multi-model AI cross-check ("independent review") | ✅ | partial (Clio Duo, single model) | ❌ | — | ❌ |
| Case-law citation health check (note-up) | ✅ (CanLII, Canada) | ✅ (vLex, paid, global) | ❌ | — | ❌ |
| Witness prep / case-citation health check | ✅ | ❌ | ✅ (deposition-focused) | — | ❌ |
| Redaction/disclosure flagging | ✅ (flag-only) | ❌ | partial | ✅ (real redaction) | ❌ |
| Self-hosted, your own data | ✅ | ❌ (cloud only) | ❌ | ❌ | ✅ |
| Installable app + push notifications (PWA) | ✅ | ✅ (native app, not just PWA) | ✅ (native app) | n/a | mixed |
| Native mobile app (iOS/Android store listing) | ❌ | ✅ | ✅ | n/a | mixed |
| Online client payments | ✅ (Stripe) | ✅ | ✅ | n/a | ✅ |
| Two-way personal calendar sync | ❌ (native only) | ✅ | ✅ | n/a | mixed |
| Accounting software sync (QuickBooks/Xero) | ✅ (QuickBooks) | ✅ | ✅ | n/a | ✅ |
| Live deposition AI monitoring | ❌ | ❌ | ✅ | — | ❌ |
| Real automated redaction | ❌ (by design) | ❌ | ❌ | ✅ | ❌ |
| Court e-filing / docketing integration | ❌ | partial | partial | n/a | ❌ |
| SMS texting with clients | ✅ (Twilio) | ✅ (most) | ✅ | n/a | mixed |
| Passkey / passwordless login | ✅ | mixed | mixed | — | ❌ |

## What's actually missing — grouped by whether it's a real gap or a deliberate trade-off

**Closed since the original comparison:**
- **Online client payments** — Stripe added (invoices and trust deposits kept
  strictly separate).
- **Accounting software sync** — QuickBooks Online invoice sync added.
- **SMS texting with clients** — Twilio texting added.
- **Native mobile app — partially closed.** Still no App Store/Play Store
  listing (see below, still a real gap), but the app is now an installable
  PWA with real web push notifications (`push_subscriptions`/`notifications`
  tables), which covers the home-screen-icon and re-engagement use cases
  most firms actually wanted from "mobile," just not offline native APIs
  (camera roll integration, background sync) or app-store discoverability.

**Real gaps still worth considering:**
- **Native mobile app (true store-distributed app)** — re-verified this
  research pass: Clio, MyCase, PracticePanther, Filevine, and Smokeball all
  still lead with dedicated iOS/Android apps in 2026. The PWA above narrows
  this but doesn't close it — no offline-first native experience, no
  App Store presence for discoverability/trust signaling to prospective
  clients researching a firm.
- **Court e-filing / docketing sync** — unchanged; deadline rules here are
  firm-authored, not pulled from an actual court e-filing system. Re-searched
  this pass and couldn't confirm competitors have moved meaningfully further
  here either — this looks like an industry-wide soft spot, not just ours.
- **Two-way personal calendar sync** (Outlook/Google) — unchanged, see
  deliberate trade-off below.

**New capabilities built since the original comparison (not gaps — worth
noting as this app's actual differentiators, or as keeping pace with a real
2026 trend):**
- **AI evidence-connections graph** — visualizes how documents, allegations,
  and evidentiary gaps relate to each other. Competitors' AI features are
  mostly text-output (summaries, matrices); a graph view of the same
  analysis is a step ahead of the "bolt-on AI" pattern most full-suite
  competitors still use.
- **Multi-model AI cross-check** ("independent review," DeepSeek/Moonshot as
  reviewers of the primary answer) — re-searched this pass: this is a real,
  live 2026 trend (Luminance's "panel of judges" multi-agent
  cross-verification is the closest public example), not something unique
  to this app, but it does mean this app is keeping pace with a real
  anti-hallucination trend rather than lagging it.
- **CanLII-backed case-citation health check** — Clio's answer here is the
  ~$1B vLex acquisition (paid, broad international coverage). This app's
  CanLII integration is free and Canada-specific, which is a genuinely
  better fit for the actual target market (solo/small Ontario firms) than a
  paid global research platform would be, even though it's narrower in
  scope.
- **Financial reporting** — AR aging, trust retainer low-balance alerts,
  matter profitability, and cost/disbursement tracking with receipt capture
  now exist; brings billing from "record time and invoice" up to parity
  with what full-suite competitors offer here.
- **Passkey/WebAuthn login** — most competitors still lean on
  password + optional 2FA; passwordless login is ahead of, not behind, the
  pack here.
- **Client-portal document-share email notification** — closes a real UX
  gap this app itself had (sharing a document previously only flipped a
  visibility flag with no notification) — brings portal document sharing up
  to the "client gets notified" baseline competitors' portals already have.

**Deliberate trade-offs, not oversights (documented reasoning already
exists for these):**
- **No two-way personal calendar sync** (Outlook/Google) — this app used to
  have OAuth calendar push and *removed* it in favor of a fully native
  calendar, specifically to avoid requiring a developer-registered cloud
  app per provider for a non-technical firm. A real trade-off (no sync to a
  lawyer's personal phone calendar), made on purpose.
- **No real automated redaction** — Everlaw/Reveal do this at enterprise
  eDiscovery scale with infrastructure (page/position mapping) this app
  doesn't have. Flagging for manual redaction instead was the safer choice
  given the privilege-waiver risk of a wrong auto-redaction.
- **No live deposition AI monitoring** — Filevine's "AI second chair"
  watches testimony in real time; this app only analyzes documents/
  transcripts already uploaded. A genuinely different (and much bigger)
  feature to build — real-time audio/video ingestion mid-deposition — not
  a small gap to close.

**Out of scope for this app's target size (small/solo firm, not
enterprise):**
- Predictive coding / technology-assisted review, bulk custodian-based
  culling — these matter at eDiscovery scale (thousands to millions of
  documents), not the matter volumes this app is built for.
- Formal litigation-hold notice/acknowledgment workflow — legal hold here
  is a simple per-matter flag + reason, not a tracked notice-and-confirm
  process; probably fine at this scale unless real need for it shows up.

Sources checked (original pass): [The Best Law Practice Management Software in 2026](https://www.consultwebs.com/blog/best-law-practice-management-software-2026/),
[The Best Legal Practice Management Software (2026 Review + Comparison)](https://www.practicepanther.com/blog/best-legal-practice-management-software/),
[Best Legal Practice Management Software for Your Firm in 2026 | MyCase](https://www.mycase.com/blog/legal-case-management/best-legal-practice-management-software/),
[9 Legal AI Tools US Law Firms Are Using in 2026 - Smokeball](https://www.smokeball.com/blog/10-ai-apps-for-your-legal-toolbox),
[AI Deposition Analysis | Filevine](https://www.filevine.com/legal-encyclopedia/ai-deposition-analysis/),
[AI Deposition Software with Summaries & Video Transcripts | Filevine](https://www.filevine.com/platform/deposition-software/),
[Compare CASEpeer vs Filevine](https://www.cbinsights.com/compare/casepeer-vs-filevine),
[Best On-Premises Legal Case Management Software of 2025 - SourceForge](https://sourceforge.net/software/legal-case-management/on-premise/),
[Top 5 Open Source Case Management Tools for Law Firms (2025) | Worklenz](https://worklenz.com/blog/05-best-open-source-case-management-software-for-your-law-firm/),
[Everlaw vs Logikcull 2026 | eDiscovery | SoftwareReviews](https://www.infotech.com/software-reviews/categories/ediscovery/compare/everlaw-vs-logikcull),
[eDiscovery Software | Logikcull](https://www.logikcull.com/product/ediscovery).

Sources checked (this revision, August 2026): [[2026] Best Law Practice Management Software - Clio](https://www.clio.com/compare/),
[The Best Legal Practice Management Software (2026 Review + Comparison)](https://www.practicepanther.com/blog/best-legal-practice-management-software/),
[Case Management Software Comparison 2026 | My Legal Academy](https://mylegalacademy.com/kb/case-management-software-comparison-2026),
[Best AI Tools for Lawyers in 2026 | The Legal Prompts](https://thelegalprompts.com/blog/best-ai-tools-lawyers),
[A Guide To AI-Powered Legal Technology Companies - Forbes](https://www.forbes.com/sites/allbusiness/2026/05/16/a-guide-to-ai-powered-legal-technology-companies/).
