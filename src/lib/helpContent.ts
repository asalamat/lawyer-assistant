export interface HelpItem {
  slug: string;
  name: string;
  detail: string;
}

export interface HelpSection {
  title: string;
  items: HelpItem[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Matters",
    items: [
      {
        slug: "create-manage-matters",
        name: "Create & manage matters",
        detail:
          "Create a matter with a title, client name, client email, matter type, and an optional default hourly billing rate. A conflict-of-interest check runs automatically against every existing client name (exact and near-miss spelling) when you fill in the client name. Search/filter the matters list by text or open/closed/archived status. Close, reopen, archive, or permanently delete a matter at any time from its Overview tab — a matter placed on legal hold (see Compliance below) can't be deleted until the hold is released.",
      },
      {
        slug: "compliance",
        name: "Compliance",
        detail:
          "Each matter has a classification (standard/privileged/highly-sensitive), an optional retention date (informational — nothing auto-deletes on it), and a legal hold toggle. A matter on legal hold shows a badge in its header and can't be deleted, even from the danger zone, until the hold is released. All changes here are recorded in the audit log.",
      },
      {
        slug: "document-upload",
        name: "Document upload",
        detail:
          "Drag and drop files onto a matter. Text, PDF, Word (.docx), Excel/CSV, images (via OCR), and audio/video recordings (via OpenAI Whisper, once configured) are readable by chat and AI features — other file types still upload but aren't used as AI context. Identical files uploaded twice are flagged as duplicates. Documents are encrypted at rest and decrypted transparently when read.",
      },
      {
        slug: "notes",
        name: "Notes",
        detail:
          "Add free-text notes or findings to a matter — dictate them with the microphone button instead of typing if you prefer. Notes are included as context for the matter digest, alongside uploaded documents.",
      },
      {
        slug: "reference-library",
        name: "Reference library",
        detail:
          "Upload statutes, case law, or other reference material once (nav > Reference library), then attach whichever documents are relevant to a specific matter from that matter's Overview tab. Attached reference documents are included in that matter's chat/digest/drafts/evidence-matrix context — attaching is per matter on purpose, so an unrelated matter doesn't get, say, the entire Criminal Code stuffed into its AI context.",
      },
      {
        slug: "clients",
        name: "Clients",
        detail:
          "Every matter is automatically linked to a client record (nav > Clients) — creating a second matter for the same client (same name and email) links it to the same client instead of creating a duplicate, so a client's detail page shows their full matter history in one place.",
      },
      {
        slug: "timesheet-invoicing",
        name: "Timesheet & invoicing",
        detail:
          "Log time against a matter, set one default hourly rate per matter, select unbilled entries to generate an invoice with an optional discount, track paid/unpaid status, and email the invoice to the client (once SMTP is configured in Settings) or open it as a draft in your own mail client.",
      },
      {
        slug: "email",
        name: "Email",
        detail:
          "Compose and send an email directly from a matter once SMTP is configured in Settings. Use Smart draft to describe what the email should say and get a grounded subject+body draft citing the matter documents it's based on — always review before sending. Attach any of the matter's own uploaded documents when sending. Connected inboxes (Gmail/Microsoft via OAuth, or Yahoo via an app password) can also be browsed and a message imported into the matter as a document.",
      },
    ],
  },
  {
    title: "AI features (per matter)",
    items: [
      {
        slug: "chat",
        name: "Chat",
        detail:
          "Ask questions grounded in that matter's uploaded documents and notes — dictate the question instead of typing if you prefer. Under the hood, chat retrieves the most relevant passages from your documents (rather than dumping every document into every question), so it stays accurate and fast even on matters with a large volume of material. Citations include a page number when the source is a PDF, e.g. \"(file.pdf, p. 4)\". Any filename cited is checked against the matter's real documents — an unverified citation is flagged in the answer. Rate answers with a thumbs up/down, or request an independent second-opinion review of any answer from Google Gemini (requires a Gemini key in Settings).",
      },
      {
        slug: "matter-digest",
        name: "Matter digest",
        detail:
          "Generates an executive summary: parties, key dates, facts, evidence inventory, and open questions — all cited to source documents and notes. Renders as proper formatted text (real headings and lists, not literal \"##\"/\"-\" characters); use Export PDF to open a clean, printable copy in a new tab and save it via your browser's print dialog.",
      },
      {
        slug: "independent-review",
        name: "Independent review",
        detail:
          "Get a second opinion from Google Gemini on a generated digest, evidence matrix, or any individual chat answer, to catch blind spots a single model might share with itself. Requires a Gemini key in Settings.",
      },
      {
        slug: "deadlines",
        name: "Deadlines",
        detail:
          "Extracts genuine deadlines, court dates, and limitation periods from uploaded documents. Re-extracting replaces the list with a fresh read of current documents. Upcoming deadlines across all matters also show on the Dashboard.",
      },
      {
        slug: "evidence-matrix",
        name: "Evidence matrix",
        detail:
          "Maps allegations/charges to the elements that must be proven, the supporting evidence for each, and evidentiary gaps. Does not predict outcomes. Once generated, click Visualize to see it as a node graph — parties, allegations, evidence, and gaps, with their connections. Click any node to highlight just its direct connections, or use the checkboxes to show/hide a whole category and narrow down what you're looking at.",
      },
      {
        slug: "drafting",
        name: "Drafting",
        detail:
          "Generates a first-draft research memo, demand letter, client correspondence, or defence strategy memo grounded in matter documents, with page-number citations for PDF sources. The defence strategy memo specifically covers the opposing case, its weaknesses, viable defence theories ranked by evidentiary support, procedural issues worth raising, and recommended next investigative steps. Dictate your instructions instead of typing if you prefer. Unsupported sections are marked for lawyer input rather than invented — always a draft for review, never a final document. Export PDF opens a clean, printable copy in a new tab. Once a defence strategy memo exists, click Visualize on the Defence graph below it to see weaknesses/theories/issues/next-steps as a node graph — same click-to-focus and type-filter controls as the Evidence matrix graph.",
      },
      {
        slug: "ai-redundancy",
        name: "AI provider redundancy",
        detail:
          "Configure a second AI provider (OpenAI) as a backup in Settings > AI model. If your primary provider fails for a request (billing, rate limit, outage), the app automatically falls through to the backup for that request. You can reorder which provider is tried first.",
      },
    ],
  },
  {
    title: "Oversight",
    items: [
      {
        slug: "search",
        name: "Search",
        detail:
          "The search icon in the nav searches across everything at once — matter titles/clients/types, document filenames, chat message content, digests, drafts, and evidence matrices — with a snippet showing where the match was found.",
      },
      {
        slug: "audit-log",
        name: "Audit log & matter timeline",
        detail:
          "Every matter/document/chat/digest/feedback/status/invoice/email/user-management action is recorded with a timestamp and who did it — viewable app-wide at Audit log, or filtered to one matter in its Activity timeline section. Also flags duplicate document uploads (same file content uploaded twice). The log is tamper-evident: each entry is cryptographically chained to the one before it, so an edit or deletion made outside the app is detectable. Admins can check this any time with the \"Verify log integrity\" button on the Audit log page. If it ever reports broken and you've identified and fixed a genuine cause (not unexplained tampering), an admin can re-anchor the chain from that point — this requires typing a reason, which is then recorded permanently as the next log entry, so there's always a record of why.",
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        slug: "ai-model",
        name: "AI model",
        detail:
          "Configure the Anthropic API key used for all AI features, plus an optional OpenAI backup key and provider order. Takes effect immediately, no restart needed.",
      },
      {
        slug: "transcription",
        name: "Transcription",
        detail: "Configure an OpenAI API key to enable audio/video document transcription (Whisper).",
      },
      {
        slug: "legal-research",
        name: "Legal research",
        detail:
          "Configure a CanLII API key to enable case-law lookup, citation history, and legislation watches — add a specific statute/regulation to watch for repeal-status, effective-date, or section-structure changes (CanLII's API doesn't expose statute text, so in-place wording amendments can't be detected). Check manually, or set up an OS-level cron job against the check-all endpoint using the auto-generated cron secret shown on this page.",
      },
      {
        slug: "email-smtp",
        name: "Email (SMTP)",
        detail: "Configure an outgoing SMTP mail server so the app can send invoices and matter email directly to clients.",
      },
      {
        slug: "software-updates",
        name: "Software updates",
        detail: "Checks this installation's git commit against the latest on GitHub and can pull updates in place.",
      },
      {
        slug: "appearance",
        name: "Appearance",
        detail: "Light/Dark/System theme, temperature unit, and current-weather location.",
      },
      {
        slug: "integrations",
        name: "Integrations",
        detail:
          "Connect a Gmail or Microsoft (Outlook/Hotmail/Office 365) mailbox via OAuth to browse and import matter-related email — requires an OAuth app registered with the provider (see the note in each row for the exact redirect URI to register). Yahoo doesn't allow third-party OAuth mail-read access at all, so it connects differently: generate a Yahoo app password (Account Security > Generate app password, after enabling Two-Step Verification) and enter it directly — no app registration needed for Yahoo.",
      },
      {
        slug: "security",
        name: "Security",
        detail:
          "Change your own login password here — this page is available to every user, not just admins (or reset a forgotten one from the terminal with npm run reset-password -- you@example.com). Login is rate-limited per account after repeated failed attempts.",
      },
      {
        slug: "users",
        name: "Users",
        detail:
          "Admin-only. Add a lawyer or staff account with a role (admin/lawyer/staff) — a temporary password is shown once for you to pass along; they're required to set their own password on first login. Change anyone's role, reset a password, or deactivate an account (deactivating immediately signs them out everywhere). Everyone can see every matter today; roles control access to Settings/API keys and user management, not matter visibility.",
      },
      {
        slug: "backup",
        name: "Backup & restore",
        detail:
          "Admin-only. \"Backup now\" saves the entire app — matters, documents, clients, users, settings — into one downloadable file; the last 10 are kept automatically. Restoring replaces all current data with a backup's contents (current data is moved aside on disk, not deleted, but you must restart the app right after for the restore to take effect) — typing \"RESTORE\" is required to confirm. For automatic backups on a schedule, this page shows a command to wire into an OS-level scheduled task (cron on macOS/Linux, Task Scheduler on Windows) — there's no built-in scheduler. Note: the encryption key isn't included in the backup (it lives in the macOS Keychain, or a separate file on Windows/Linux) — back that up separately too, or a restored backup's secrets/documents can't be decrypted.",
      },
    ],
  },
];

export function findHelpItem(slug: string): HelpItem | null {
  for (const section of HELP_SECTIONS) {
    const item = section.items.find((i) => i.slug === slug);
    if (item) return item;
  }
  return null;
}
