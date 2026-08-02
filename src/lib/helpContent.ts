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
          "Create a matter with a title, client name, client email, matter type, and an optional default hourly billing rate. Search/filter the matters list by text or open/closed/archived status. Close, reopen, archive, or permanently delete a matter at any time from its Overview tab.",
      },
      {
        slug: "document-upload",
        name: "Document upload",
        detail:
          "Drag and drop files onto a matter. Text, PDF, Word (.docx), Excel/CSV, images (via OCR), and audio/video recordings (via OpenAI Whisper, once configured) are readable by chat and AI features — other file types still upload but aren't used as AI context. Identical files uploaded twice are flagged as duplicates.",
      },
      {
        slug: "notes",
        name: "Notes",
        detail:
          "Add free-text notes or findings to a matter. Notes are included as context for the matter digest, alongside uploaded documents.",
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
          "Compose and send an email directly from a matter once SMTP is configured in Settings. Connected inboxes (Gmail/Microsoft, once an OAuth app is registered) can also be browsed and a message imported into the matter as a document.",
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
          "Ask questions grounded only in that matter's uploaded documents and notes. Any filename cited is checked against the matter's real documents — an unverified citation is flagged in the answer. Rate answers with a thumbs up/down for later review.",
      },
      {
        slug: "matter-digest",
        name: "Matter digest",
        detail:
          "Generates an executive summary: parties, key dates, facts, evidence inventory, and open questions — all cited to source documents and notes.",
      },
      {
        slug: "independent-review",
        name: "Independent review",
        detail:
          "Get a second opinion from Google Gemini on a generated digest or evidence matrix, to catch blind spots a single model might share with itself. Requires a Gemini key in Settings.",
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
          "Maps allegations/charges to the elements that must be proven, the supporting evidence for each, and evidentiary gaps. Does not predict outcomes.",
      },
      {
        slug: "drafting",
        name: "Drafting",
        detail:
          "Generates a first-draft research memo, demand letter, or client correspondence grounded in matter documents. Unsupported sections are marked for lawyer input rather than invented — always a draft for review, never a final document.",
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
          "Every matter/document/chat/digest/feedback/status/invoice/email action is recorded with a timestamp — viewable app-wide at Audit log, or filtered to one matter in its Activity timeline section. Also flags duplicate document uploads (same file content uploaded twice).",
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
        detail: "Configure a CanLII API key to enable case-law lookup and citation history.",
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
          "Connect a Gmail, Microsoft (Outlook/Hotmail/Office 365), or Yahoo mailbox to bring matter-related email into the app. Requires an OAuth app registered with the provider — see the note in each provider's row for the redirect URI to register.",
      },
      {
        slug: "security",
        name: "Security",
        detail:
          "Change your login password (or reset a forgotten one from the terminal with npm run reset-password). Login is rate-limited after repeated failed attempts.",
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
