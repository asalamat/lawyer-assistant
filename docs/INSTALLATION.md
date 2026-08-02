# Installation

This app runs as a single Next.js process on one machine, with a local SQLite
database (`node:sqlite`, built into Node — no separate database server to
install or run) and local file storage for uploaded documents.

## Prerequisites

- **Node.js 22.5 or newer** (24.x recommended — this is what's used throughout
  development). `node:sqlite` requires at least 22.5.
- **npm** (ships with Node).
- **git**, if installing from the GitHub repo (also needed for the in-app
  "check for updates" feature in Settings > Software updates).

## 1. Get the code

```bash
git clone https://github.com/asalamat/lawyer-assistant.git
cd lawyer-assistant
npm install
```

## 2. Run it

For local use / development:

```bash
npm run dev
```

Then open `http://localhost:3000`.

For a longer-running deployment, build once and run the production server:

```bash
npm run build
npm run start
```

`npm run start` does not auto-restart on its own — if you use the in-app
update checker to pull new commits, restart the process manually afterward
to pick up the change (`npm run dev` hot-reloads automatically instead).

## 3. First run: set a password

The app has no default password. The first time you open it, you'll land on
`/login` and be prompted to set one — this is stored locally (scrypt-hashed)
in `data/auth.json`, not sent anywhere. There's no "forgot password" flow in
the UI by design (a recovery flow would be a bypass path for a single-user
app); if you forget it, reset from the terminal:

```bash
npm run reset-password
```

## 4. Configure AI features (Settings)

Everything below is configured from inside the app at **Settings** — no
`.env` file editing required for day-to-day use. Settings are stored locally
in `data/settings.json` (0600 file permissions).

| Feature | Settings page | Requires |
|---|---|---|
| Chat, digests, drafting, evidence matrix, deadlines | Settings > AI model | An Anthropic API key |
| Automatic AI failover if the primary provider fails | Settings > AI model | An OpenAI API key (optional, as backup) |
| Audio/video transcription | Settings > Transcription | An OpenAI API key (same key as above) |
| Independent second-opinion review | Settings > Independent review | A Google Gemini API key (optional) |
| Case-law lookup / citation history | Settings > Legal research | A CanLII API key (optional — request one via CanLII's feedback form) |
| Sending invoices/email from the app | Settings > Email | Your own SMTP mail server details (host/port/username/app password) |
| Current temperature in the nav bar | Settings > Appearance | A city name (uses Open-Meteo, no API key needed) |

Only the Anthropic key is required to use the app's core features. Everything
else is optional and the app works without it — those sections just stay
inactive until configured.

Alternatively, an Anthropic key can be set via environment variable instead
of the Settings UI: copy `.env.local.example` to `.env.local` and fill in
`ANTHROPIC_API_KEY`. A key entered in Settings always takes priority over the
environment variable.

## 5. Optional: connect email accounts (Settings > Integrations)

- **Yahoo** — no app registration needed. Enable Two-Step Verification on
  your Yahoo account, generate an app password (Yahoo Account Security >
  Generate app password), and enter your email + that app password directly
  in Settings > Integrations. This works out of the box.
- **Gmail** — requires registering an OAuth app in Google Cloud Console,
  with redirect URI `{this app's URL}/api/integrations/google/callback`
  authorized. Enter the resulting Client ID + Secret in Settings >
  Integrations, then click Connect.
- **Microsoft** (covers Outlook.com, Hotmail, and Office 365 in one app) —
  same idea, registered in Microsoft Entra ID, redirect URI
  `{this app's URL}/api/integrations/microsoft/callback`.

None of these are required for the app's core matter-management features.

## Data & backup

Everything the app stores lives under `data/` in the project directory
(gitignored, never committed):

- `data/app.db` — the SQLite database (matters, documents metadata, chat,
  digests, invoices, etc.)
- `data/uploads/` — uploaded document files
- `data/settings.json` — API keys and integration config
- `data/auth.json` — password hash and session token
- `data/oauth.json` — OAuth app credentials for email integrations

To back up the app, copy the entire `data/` directory. There is no separate
database server or external storage to worry about.

## Updating

Once running, **Settings > Software updates** compares your local commit
against the GitHub repo and can pull the latest changes (fast-forward only —
it refuses if you have uncommitted local changes). After pulling, restart the
process if running via `npm run start`; `npm run dev` picks changes up
automatically.

To update dependencies after a pull that adds new packages, run
`npm install` again before restarting.
