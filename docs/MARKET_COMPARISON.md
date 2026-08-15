# Market comparison (2026)

A snapshot comparison against real competitors, researched live (not from
training-data assumptions) and cross-checked against this app's actual
codebase before being written down. See the "What's missing" section below
for the honest gap list this comparison produced.

## Feature comparison snapshot

| Capability | Lawyer Assistant | Clio/MyCase/PracticePanther/Smokeball/CosmoLex | Filevine | Everlaw/Logikcull/Reveal | Tabs3/HoudiniEsq |
|---|---|---|---|---|---|
| Matters, billing, trust accounting | ✅ | ✅ | ✅ | — | ✅ |
| AI digests/evidence matrices/contradictions | ✅ | partial (bolt-on AI) | ✅ (deeper) | — | ❌ |
| Witness prep / case-citation health check | ✅ | ❌ | ✅ (deposition-focused) | — | ❌ |
| Redaction/disclosure flagging | ✅ (flag-only) | ❌ | partial | ✅ (real redaction) | ❌ |
| Self-hosted, your own data | ✅ | ❌ (cloud only) | ❌ | ❌ | ✅ |
| Native mobile app | ❌ | ✅ | ✅ | n/a | mixed |
| Online client payments | ❌ | ✅ | ✅ | n/a | ✅ |
| Two-way personal calendar sync | ❌ (native only) | ✅ | ✅ | n/a | mixed |
| Accounting software sync (QuickBooks/Xero) | ❌ | ✅ | ✅ | n/a | ✅ |
| Live deposition AI monitoring | ❌ | ❌ | ✅ | — | ❌ |
| Real automated redaction | ❌ (by design) | ❌ | ❌ | ✅ | ❌ |
| Court e-filing / docketing integration | ❌ | partial | partial | n/a | ❌ |
| SMS texting with clients | ❌ | ✅ (most) | ✅ | n/a | mixed |

## What's actually missing — grouped by whether it's a real gap or a deliberate trade-off

**Real gaps worth considering (every competitor above has these, we don't):**
- **Online client payments** (credit card / ACH collection, LawPay-style
  trust-compliant processing) — every full-suite competitor treats it as
  table stakes. Explicitly excluded from this app's scope so far by choice.
- **Native mobile app** — this is a web app only, no iOS/Android client.
  Clio, MyCase, PracticePanther, Filevine all lead with mobile.
- **Accounting software sync** (QuickBooks/Xero) — never started; every
  full-suite competitor integrates one or both.
- **SMS texting with clients** — confirmed via the codebase itself: `db.ts`
  documents "no real SMS/texting integration" as a known gap. Portal
  messaging is in-app only.
- **Court e-filing / docketing sync** — deadline rules here are
  firm-authored, not pulled from an actual court e-filing system the way
  some competitors partially offer.

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

Sources checked: [The Best Law Practice Management Software in 2026](https://www.consultwebs.com/blog/best-law-practice-management-software-2026/),
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
