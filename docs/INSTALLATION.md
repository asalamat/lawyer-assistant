# Installation

This app runs as a single Next.js process on one machine, with a local SQLite
database (`node:sqlite`, built into Node — no separate database server to
install or run) and local file storage for uploaded documents. It runs
identically on macOS, Windows, and Linux — nothing in the codebase is
platform-specific (encryption keys use the macOS Keychain when available
and fall back to a local file everywhere else, automatically).

## Prerequisites

- **Node.js 22.5 or newer** (24.x recommended — this is what's used throughout
  development). `node:sqlite` requires at least 22.5.
  Download: https://nodejs.org (choose the LTS installer for your OS —
  this also installs npm).
- **npm** (ships with Node).
- **git**, if installing from the GitHub repo (also needed for the in-app
  "check for updates" feature in Settings > Software updates). macOS
  prompts to install git automatically the first time you run a `git`
  command, if it isn't already present. Windows: https://git-scm.com/download/win

## Quick install (one command)

Once Node.js and git are installed, this single command clones the repo,
installs dependencies, and starts the app:

**macOS / Linux (Terminal):**
```bash
git clone https://github.com/asalamat/lawyer-assistant.git && cd lawyer-assistant && npm install && npm run dev
```

**Windows (Command Prompt or PowerShell):**
```bat
git clone https://github.com/asalamat/lawyer-assistant.git && cd lawyer-assistant && npm install && npm run dev
```
(The same command works in both — `&&` chaining works in Command Prompt and
in PowerShell 7+. If you're on the older Windows PowerShell 5.1 and it
errors on `&&`, run the four commands one line at a time instead, or use
`;` as the separator.)

Then open `http://localhost:3000` in a browser. The step-by-step breakdown
below explains what each part of that command does, plus how to configure
AI features afterward.

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

## 3. First run: create the first account

The app has no default account. The first time you open it, you'll land on
`/login` and be prompted to create the first admin account (email, name,
password) — the password is stored locally (scrypt-hashed) in the SQLite
database, never sent anywhere. Once that account exists, the admin can add
further lawyer/staff accounts from Settings > Users (each gets a temporary
password to change on first login) — see Settings > Security and Settings >
Users in the in-app Help for details.

There's no "forgot password" flow in the UI by design (a self-service
recovery flow would be a bypass path); if an account is locked out, reset it
from the terminal, in the project directory:

```bash
npm run reset-password -- you@example.com
```

Note `npm run reset-password` only clears the password — if that account also
has two-factor authentication (below) turned on, they'll still need it after
resetting. An admin can turn 2FA off for a locked-out account from Settings >
Users if needed.

### Optional: two-factor authentication (2FA)

Each user can turn on 2FA for their own account from **Settings > Security** —
scan the QR code shown there with an authenticator app (Google Authenticator,
1Password, Authy, etc.), confirm with the 6-digit code it generates, and save
the one-time backup codes shown right after (each works once, for when the
authenticator app itself isn't available). This is entirely optional and
per-account — nothing here requires a third-party service or API key, the
whole thing runs locally.

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

- `data/app.db` — the SQLite database: matters, clients, documents
  metadata, chat, digests, invoices, users/sessions/roles, and the audit log
- `data/uploads/` — uploaded document files, encrypted at rest
- `data/reference-uploads/` — shared reference-library files, also encrypted
- `data/settings.json` — API keys, SMTP credentials, and integration
  config; secrets are encrypted at rest (AES-256-GCM)
- `data/auth.json` — legacy file, kept only for one-time migration from
  versions before multi-user accounts existed; empty on a fresh install
- `data/oauth.json` — OAuth app credentials for email integrations

Encryption key: on macOS the AES key used to encrypt secrets/documents
lives in the Keychain (separate from `data/`, so a copy of `data/` alone
isn't decryptable without also having Keychain access on that same Mac).
On Windows/Linux it falls back to a key file outside `data/`, at
`~/.lawyer-assistant/masterkey` (`%USERPROFILE%\.lawyer-assistant\masterkey`
on Windows) — **back that file up too**, alongside `data/`, or encrypted
documents/secrets can't be decrypted after a restore.

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

## Uninstalling

There's no installer to run in reverse — this app is just the project
directory plus a couple of small files it stores outside it (the encryption
key, and, only on macOS, one Keychain entry). Back up `data/` first if you
might want this installation's matters/documents/settings again later — see
"Data & backup" above.

**1. Stop the app.** If it's running in a terminal (`npm run dev` or
`npm run start`), press `Ctrl+C` there. If it's running in the background:

macOS / Linux:
```bash
pkill -f "next start"   # or: pkill -f "next dev"
```
Windows (Command Prompt or PowerShell), find and stop the Node process:
```bat
tasklist | findstr node
taskkill /PID <the PID from the line above> /F
```

**2. Remove any scheduled tasks you set up.** If you wired the optional
backup-scheduling or legislation-watch endpoints into an OS scheduler
(Settings > Backup / Settings > Legal research), remove those entries too —
this app never creates them on its own, so only remove what you added
yourself:
- **macOS / Linux (cron):** `crontab -e` and delete the line(s) referencing
  this app's URL/`check-all`/`scheduled` endpoints.
- **Windows (Task Scheduler):** open Task Scheduler, find the task you
  created for this app, right-click > Delete.

**3. Remove the encryption key stored outside the project directory** — it's
useless without `data/` and vice versa, so delete both together or neither:

macOS:
```bash
security delete-generic-password -a masterEncryptionKey -s LawyerAssistant
```
(If that reports "item could not be found," the key was stored as a fallback
file instead — see the Windows/Linux command below; either is normal
depending on Keychain availability at the time.)

Windows (Command Prompt):
```bat
del "%USERPROFILE%\.lawyer-assistant\masterkey"
```
Linux, or Windows PowerShell:
```bash
rm -f ~/.lawyer-assistant/masterkey
```

**4. Delete the project directory** — this removes everything else
(`data/`, the app code, `node_modules`):

macOS / Linux:
```bash
rm -rf /path/to/lawyer-assistant
```
Windows (Command Prompt or PowerShell):
```bat
rmdir /s /q "C:\path\to\lawyer-assistant"
```

Node.js and git are general-purpose developer tools, not specific to this
app — uninstall them separately (via the OS's normal Programs/Apps removal,
or `brew uninstall node` on macOS with Homebrew) only if nothing else on the
machine needs them.
