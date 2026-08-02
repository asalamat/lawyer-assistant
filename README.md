# Lawyer Assistant

A legal matter-management and AI-assisted case-work app: matter/client
tracking, document intake (PDF/Word/Excel/images/audio via OCR and
transcription), per-matter AI chat/digests/drafting grounded in uploaded
documents, deadline extraction, timesheets and invoicing, and email
integration.

See **[docs/INSTALLATION.md](docs/INSTALLATION.md)** for setup instructions,
and **[docs/ROADMAP.md](docs/ROADMAP.md)** for what's built, what's
deliberately deferred, and what's blocked on an account/API-key decision.

## Quick start

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` — first run prompts you to set a login
password, and AI features are configured afterward from inside the app at
Settings > AI model (no `.env` editing required). Full details in
[docs/INSTALLATION.md](docs/INSTALLATION.md).

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS v4 ·
`node:sqlite` (no external database server) · Anthropic Claude with an
optional OpenAI failover.
