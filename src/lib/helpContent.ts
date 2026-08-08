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
    title: "General",
    items: [
      {
        slug: "leads",
        name: "Leads",
        detail:
          "A board (nav > Leads) for tracking prospective clients before a matter exists — the intake questionnaire and everything else in this app assumes a matter is already open, this is the layer before that. Add a lead with just a name (email/source optional), then move it through New → Contacted → Consultation scheduled → Proposal sent → Won/Lost using the dropdown on its card or its own detail page. When it's ready, \"Convert to matter\" on the lead's detail page creates a real matter (and client, if one doesn't already exist) the same way the normal new-matter flow does — the lead's own record stays intact afterward with a link to the matter it became, marked Won automatically.",
      },
      {
        slug: "sticky-notes",
        name: "Sticky notes",
        detail:
          "The note icon in the bottom-right corner of every page lets you leave yourself quick reminders pinned to that specific page — a matter's Digest tab, the Dashboard, Settings, anywhere. Click it to drop a new note right on the page, then just start typing — it saves automatically as you go. Drag a note anywhere on screen by its top bar (the color dots) to reposition it; where you leave it is remembered the next time you open that page. Add as many as you like per page, pick a color for each with the dots at the top of the note, and click the ✕ to remove one you're done with. These are private to you: no one else, including other staff who open the same page, ever sees them.",
      },
    ],
  },
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
          "Each matter has a classification (standard/privileged/highly-sensitive), an optional retention date (informational — nothing auto-deletes on it), a legal hold toggle, and an ethical wall toggle. A matter on legal hold shows a badge in its header and can't be deleted, even from the danger zone, until the hold is released. Applying an ethical wall restricts the matter to whoever is on its Team assignment list (see below) plus admins — everyone else is transparently redirected as if the matter didn't exist, on every page and API route, and the matter disappears from the matters list, dashboard, and search for them too. Assign the right team before applying a wall, not after, or only admins will be able to get back in; removing the wall restores the default shared visibility immediately. All changes here are recorded in the audit log. While a matter is still at the default \"standard\" classification, uploading documents runs an intake agent that reads them and suggests tightening the classification if the content warrants it (privileged communications, medical/financial/highly personal details) — shown as a banner with Apply/Dismiss right where you uploaded; nothing changes automatically, and once you've classified a matter (by accepting a suggestion or setting it manually) it stops suggesting.",
      },
      {
        slug: "document-upload",
        name: "Document upload",
        detail:
          "Drag and drop files onto a matter. Text, PDF, Word (.docx), Excel/CSV, images (via OCR), and audio/video recordings (via OpenAI Whisper, once configured) are readable by chat and AI features — other file types still upload but aren't used as AI context. Tables inside a PDF or Word document are detected and kept as a proper table (rows/columns preserved) instead of being flattened into a jumbled run of text — a financial schedule or exhibit table stays readable to the AI features, not just to a human looking at the original file. Dropping a .zip (e.g. a disclosure package or a folder someone zipped up) unpacks it and uploads each file inside individually — useful for bulk intake instead of uploading one at a time; a per-file result list shows what succeeded or failed. Importing an email (see Email below) also imports its attachments as their own documents, each badged \"attachment of\" the email it came with. Identical files uploaded twice are flagged as duplicates; near-identical content (e.g. the same letter re-scanned or re-saved in another format) is separately flagged as a near-duplicate, based on how similar the extracted text is, not the file bytes. If a document can't be read at all (a corrupt PDF, an unsupported encoding), it shows an \"extraction failed\" badge with the real error on hover and a Retry button, instead of silently vanishing from AI context. A chat-readable document also shows its detected language (if not English) and a quality score when it's below 70% — low quality usually means a scanned image OCR'd with low confidence, or unusually little text for the file, worth a manual look. Every upload is scanned for malware first (via a local ClamAV install, Settings > Privacy — no cloud account, nothing leaves the machine); a flagged file is quarantined to a separate location on disk instead of being stored where AI features or chat can read it, and shows a \"quarantined\" badge instead of the normal upload result. Documents are encrypted at rest and decrypted transparently when read. If the matter has a linked client, each document shows a \"Share with client\"/\"Shared with client\" toggle — turning it on is what makes that specific document visible in the client's own portal login (see Client portal below); nothing is visible to a client by default. Click \"Similar\" next to a chat-readable document to find other documents in the same matter (including attached reference-library material) with related content, ranked by similarity — useful for spotting related correspondence or content that overlaps without being a near-duplicate.",
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
          "Upload statutes, case law, or other reference material once (nav > Reference library), then attach whichever documents are relevant to a specific matter from that matter's Overview tab. Every reference document is tagged as either Firm knowledge (precedents, templates, internal know-how) or Public legal authority (statutes, case law) at upload — pick which with the toggle above the upload area; the matter attach dropdown groups by tier so it's clear which kind of material you're picking. Attached reference documents are included in that matter's chat/digest/drafts/evidence-matrix context — attaching is per matter on purpose, so an unrelated matter doesn't get, say, the entire Criminal Code stuffed into its AI context. A newly uploaded document is pending approval and can't be attached to any matter until a lawyer or admin approves it — meant to catch a client-specific document being uploaded here by mistake before it becomes reusable across other clients' matters. An automatic check flags text that looks like a real client's personal or privileged details (a warning to review, not an automatic block — a published case naming real parties will often trip it too).",
      },
      {
        slug: "clients",
        name: "Clients",
        detail:
          "Every matter is automatically linked to a client record (nav > Clients) — creating a second matter for the same client (same name and email) links it to the same client instead of creating a duplicate, so a client's detail page shows their full matter history in one place. Typing a client name on the new-matter form autocompletes against existing clients and fills in their email automatically once matched. Clients can also be added, edited, or deleted directly from the Clients page — deleting is blocked while any matter still references that client, to avoid orphaning it.",
      },
      {
        slug: "client-portal",
        name: "Client portal",
        detail:
          "A real, persistent login for a client — not a one-time link that expires. On a client's detail page, under \"Client portal access\", click \"Grant portal access\" (confirm or edit their email first) to create their account; a temporary password is shown once for you to pass along securely — they set their own on first login. If access already exists, the same button becomes \"Reset password\" and works the same way, signing them out of any existing session. The client logs in separately from staff, at /portal/login, and sees only their own matters and whichever documents you've explicitly turned \"Share with client\" on for (see Document upload above) — nothing is visible by default, and a client can never see another client's matters. One portal account per client. A matter's own \"Client messages\" tab (staff side) and the client's portal page both show the same real two-way message thread — no email, no real SMS (that would need a separate texting-provider account), just an in-app conversation either side can refresh and reply to. Downloads, grants/resets, and messages are all recorded in the audit log.",
      },
      {
        slug: "matter-team",
        name: "Team assignment",
        detail:
          "Record who's working a matter and in what capacity from its Overview tab — pick any active account at the firm and describe their role on that matter in your own words (\"Lead lawyer\", \"Paralegal\", \"Second chair\"). Somebody can only be listed once per matter, and a deactivated account can't be assigned. Assigning and removing are both recorded in the audit log. This is ordinary responsibility bookkeeping by default — everyone at the firm can still see every matter whether or not they're on its team — unless the matter's ethical wall (Compliance tab) is turned on, in which case this list becomes the actual access list.",
      },
      {
        slug: "parties-related-matters",
        name: "Parties & related matters",
        detail:
          "A matter's Parties tab records everyone involved besides the client — opposing party, opposing counsel, witnesses, experts, insurers — with a role, optional email/phone, and notes. Role is free text with common roles suggested, so unusual ones (adjuster, estate trustee, translator) still fit. Adding, editing, and removing a party is recorded in the audit log. The same tab links this matter to other matters that share an opposing party, arise from the same incident, or otherwise need reading together: search by title or file number, add an optional note explaining the connection, and the link shows on both matters' Parties tabs — unlinking from either side removes it.",
      },
      {
        slug: "consent-signatures",
        name: "Consent & signatures",
        detail:
          "A matter's \"Consent & signatures\" tab prepares retainer agreements, conflict waivers, privacy consents, or any other document that needs the client's signature, and tracks each one through draft > awaiting signature > signed/declined/voided. Optionally attach one of the matter's uploaded documents as the thing being signed — the signature record then stores that file's content hash, so it's provable later which exact version was agreed to. \"Send for signature\" issues a single-purpose link (/sign/…) to hand to the client: no login, no account, scoped to that one document, and it expires on its own after two weeks. Copy the link straight from the tab and send it however you normally reach the client. The link is only shown at the moment it's issued — if it's lost, \"Resend link\" mints a fresh one and the previous link stops working immediately. The client's page shows the document title and their name, takes their typed full legal name, an optional drawn signature, and an explicit \"I intend this as my legal signature\" confirmation; their IP address, browser, and timestamp are recorded alongside it. You can also mark a document declined (if the client says no by phone or email) or void it entirely, both of which kill any outstanding link. Every step is recorded in the audit log — signatures submitted through the client link show no attributed user, since the client isn't a user of this app. Note this is a basic electronic signature, not a certificate-backed qualified/advanced e-signature.",
      },
      {
        slug: "intake-questionnaires",
        name: "Intake questionnaires",
        detail:
          "A matter's Intake tab sends the client a no-login link (/intake/…) to a fixed intake questionnaire — full legal name, contact details and preference, how they found the firm, a description of the matter in their own words, whether another lawyer was previously retained on it, dates and deadlines they know about, and what documents they already hold. The question set is the same for every matter and isn't configurable; that's deliberate, so answers stay comparable across files. The link is scoped to that one questionnaire, works for a single submission, and expires on its own after two weeks. Copy it from the tab and send it however you normally reach the client — it's only shown at the moment it's issued, so send another questionnaire if it's lost. The client's page shows nothing about the matter itself (no title, file number, or documents), just the questions. Once submitted the tab shows their answers inline with a Completed badge; sending and completion are both recorded in the audit log, with completion showing no attributed user since the client isn't a user of this app.",
      },
      {
        slug: "timesheet-invoicing",
        name: "Timesheet & invoicing",
        detail:
          "Log time against a matter, set one default hourly rate per matter, select unbilled entries to generate an invoice with an optional discount, track paid/unpaid status, and email the invoice to the client (once SMTP is configured in Settings) or open it as a draft in your own mail client.",
      },
      {
        slug: "trust-accounting",
        name: "Trust accounting",
        detail:
          "Bookkeeping support for client trust funds (nav > Trust accounting) — not accounting or tax advice; verify against your bar's own trust-accounting rules. Admins/lawyers create one or more trust accounts there. A matter's own Trust tab records deposits, withdrawals, and transfers to your operating account against whichever trust account holds its funds, and shows a running balance computed fresh from that history every time, never a stored number that could drift. A withdrawal or transfer that would take a matter's balance negative is rejected outright — trust rules exist specifically so one client's funds are never used to cover another's shortfall. From the main Trust accounting page, \"Reconcile\" compares an account's ledger total against a bank statement balance you enter, recording the comparison (and any variance) permanently, whether or not it matches — that record is itself the audit evidence. Every deposit, withdrawal, transfer, and reconciliation is in the audit log.",
      },
      {
        slug: "email",
        name: "Email",
        detail:
          "Compose and send an email directly from a matter once SMTP is configured in Settings. Use Smart draft to describe what the email should say and get a grounded subject+body draft citing the matter documents it's based on — always review before sending. Translate the message into another language right in the compose box (defaults to whatever's set in Settings > Translation) (replaces the draft in place so you can review and send the translated version). Attach any of the matter's own uploaded documents when sending. Connected inboxes (Gmail, Microsoft, or Yahoo — see Integrations for how each connects) can also be browsed and imported into the matter as documents — pick a specific folder (Gmail label, Outlook mail folder, or Yahoo IMAP folder) from the Folder dropdown to browse anywhere in that mailbox, not just the inbox. Check the box next to any message (or \"Select all\") and click \"Import selected\" to bring in several — or even every listed message — in one action instead of one at a time; each becomes its own document, and the deadline/classification checks run once for the whole batch rather than once per email. Any real attachments on an imported email (excluding inline signature images/logos) come in too, each as its own document badged \"attachment of\" the email it arrived with.",
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
          "Ask questions grounded in that matter's uploaded documents and notes — dictate the question instead of typing if you prefer. Under the hood, chat retrieves the most relevant passages from your documents (rather than dumping every document into every question), so it stays accurate and fast even on matters with a large volume of material. Citations include a page number when the source is a PDF, e.g. \"(file.pdf, p. 4)\". Any filename cited is checked against the matter's real documents — an unverified citation is flagged in the answer. Rate answers with a thumbs up/down, translate an answer (or its independent review) into another language, export it as PDF, or request an independent second-opinion review from OpenAI (requires an OpenAI key in Settings).",
      },
      {
        slug: "matter-digest",
        name: "Matter digest",
        detail:
          "Generates an executive summary: parties, key dates, facts, evidence inventory, and open questions — all cited to source documents and notes. Citations are checked against the matter's real documents; anything that doesn't match is flagged in a banner rather than trusted blindly. Renders as proper formatted text (real headings and lists, not literal \"##\"/\"-\" characters); use Translate for a copy in another language, or Export PDF to open a clean, printable copy in a new tab and save it via your browser's print dialog.",
      },
      {
        slug: "independent-review",
        name: "Independent review",
        detail:
          "Get a second opinion from OpenAI on a generated digest, evidence matrix, or any individual chat answer, to catch blind spots a single model might share with itself. Requires an OpenAI key in Settings.",
      },
      {
        slug: "case-noteup",
        name: "Case citations",
        detail:
          "Scans this matter's documents and notes for Canadian neutral case citations (e.g. \"2020 ONCA 123\") and looks each one up on CanLII: whether it's a real, findable decision, plus its cited/citing cases and cited legislation (a \"note-up\"). Only the standard neutral-citation format is detected — citations written another way won't be picked up. Re-checking replaces the previous results; this isn't a history. Requires a CanLII key in Settings.",
      },
      {
        slug: "deadlines",
        name: "Deadlines",
        detail:
          "Extracts genuine deadlines, court dates, and limitation periods from uploaded documents. This now runs automatically right after a new document is uploaded (single file, bulk ZIP, or email import) — not just when you click re-extract — and a \"Found N new deadline(s)\" note appears where you uploaded. Re-extracting (manual or automatic) replaces the AI-extracted portion of the list with a fresh read of current documents — it never touches deadlines you calculated or added by hand, tagged \"Rule-computed\"/\"Manual\" so they always survive. Below the extracted list, \"Calculate a deadline\" lets you pick a saved rule (Settings > Deadline rules, admin-only) and the date it triggers from — e.g. \"21 business days after service\" — and adds the computed date straight to the list, correctly skipping weekends and any configured holiday for business-day rules. This is a firm-editable rule library, not a licensed jurisdiction rules database — you're responsible for keeping the rules and holiday list accurate for your own practice. Upcoming deadlines across all matters also show on the Dashboard. If a connected Google or Microsoft account has calendar sync turned on (Settings > Integrations), a rule-computed deadline pushes to that calendar automatically; any deadline — extracted, manual, or rule-computed — can also be pushed with the \"Push to calendar\" button, and shows a \"Synced\" badge once it has been. This is one-way only: an edit made directly in Google/Outlook never flows back here, and a later edit made from this app updates the same calendar event instead of creating a duplicate.",
      },
      {
        slug: "evidence-matrix",
        name: "Evidence matrix",
        detail:
          "Maps allegations/charges to the elements that must be proven, the supporting evidence for each, and evidentiary gaps. Does not predict outcomes. Citations are checked against the matter's real documents; anything that doesn't match is flagged. Translate it or export as PDF like any other generated document. Once generated, click Visualize to see it as a node graph — parties, allegations, evidence, and gaps, with their connections. Click any node to highlight just its direct connections, or use the checkboxes to show/hide a whole category and narrow down what you're looking at.",
      },
      {
        slug: "contradictions",
        name: "Contradictions",
        detail:
          "Compares witness statements and other documents for genuine inconsistencies — dates, locations, amounts, and identity/description details — with both sides of each conflict quoted and cited. Normal variation (different wording, different level of detail) is deliberately not flagged as a contradiction; only real conflicts are. Citations are checked against the matter's real documents; anything that doesn't match is flagged.",
      },
      {
        slug: "exhibit-list",
        name: "Exhibit list",
        detail:
          "Builds a numbered exhibit list from the matter's documents — description, source document, and relevance to a specific allegation or issue — the kind used to organize evidence for a hearing. Citations are checked against the matter's real documents; anything that doesn't match is flagged.",
      },
      {
        slug: "disclosure-checklist",
        name: "Disclosure checklist",
        detail:
          "Compares what's actually been disclosed against what the documents themselves reference as existing — e.g. a report that mentions a recording that isn't itself among the uploaded documents. Only flags something as missing if a document in the matter actually references it; never assumes something should exist just because it's typical for a case like this. Citations are checked against the matter's real documents; anything that doesn't match is flagged.",
      },
      {
        slug: "crown-position",
        name: "Crown position",
        detail:
          "Analyzes charges and statutory elements, available evidence for each, weaknesses, possible defences, and aggravating/mitigating factors — then ends with two or three plausible Crown positions, each with its supporting evidence, what's missing, and a confidence level (high/medium/low). Deliberately does not predict which one will happen, give a percentage, or present this as advice — it's a structured starting point for the lawyer's own judgment. Citations are checked against the matter's real documents; anything that doesn't match is flagged.",
      },
      {
        slug: "privilege-review",
        name: "Privilege & redaction review",
        detail:
          "Reviews each of the matter's documents individually (not summarized, so exact wording is preserved) for solicitor-client privileged communications/work product, and sensitive personal information beyond what's already automatically masked (SIN/SSN/credit card numbers, phone, email) — medical/psychiatric details, financial account specifics, information about a minor, immigration status, and similar. Each finding quotes the exact passage as a redaction candidate, tagged [PRIVILEGE] or [SENSITIVE]. This is a review aid, not a final privilege determination — always reviewed by a lawyer before anything is actually redacted or withheld. Citations are checked against the matter's real documents; anything that doesn't match is flagged.",
      },
      {
        slug: "drafting",
        name: "Drafting",
        detail:
          "Generates a first-draft research memo, demand letter, client correspondence, or defence strategy memo grounded in matter documents, with page-number citations for PDF sources. The defence strategy memo specifically covers the opposing case, its weaknesses, viable defence theories ranked by evidentiary support, procedural issues worth raising, and recommended next investigative steps. Dictate your instructions instead of typing if you prefer. Unsupported sections are marked for lawyer input rather than invented — always a draft for review, never a final document. Export PDF opens a clean, printable copy in a new tab. Once a defence strategy memo exists, click Visualize on the Defence graph below it to see weaknesses/theories/issues/next-steps as a node graph — same click-to-focus and type-filter controls as the Evidence matrix graph. Check \"Self-checking (agent)\" before generating for this app's first agentic feature: instead of one pass, it drafts, then actively searches the matter's own documents to double-check its own citations, and revises itself (up to two rounds) if it finds one that doesn't hold up. Slower and needs an Anthropic API key specifically (no OpenAI fallback for this one), but it can catch and fix its own mistakes rather than leaving them for you to find. Click \"Agent trace\" on any draft it produced to see exactly what it searched for and why it revised, step by step. For routine documents where an AI draft is overkill — a standard retainer letter, a form notice — see Templates below instead.",
      },
      {
        slug: "document-templates",
        name: "Templates",
        detail:
          "For routine documents you send the same way every time — a standard retainer letter, a form notice — instead of an AI draft from scratch. Anyone can author a reusable template (Settings > Document templates) as plain text with {{field}} placeholders; matter.title, matter.fileNumber, matter.matterType, matter.clientName, client.email, client.phone, today, and lawyerName fill in automatically, and anything else you write as a placeholder becomes a field you type a value for when generating. A matter's own Templates tab picks a template, prompts for just the custom fields it needs, and generates a filled-in copy in seconds — translate it, export it as PDF, or \"Save as document\" to add it to the matter's own document list (so it can be attached to an outgoing email like anything else). Deleting a template later doesn't remove documents already generated from it — each one is a complete, standalone copy at the moment it was generated.",
      },
      {
        slug: "ai-redundancy",
        name: "AI provider redundancy",
        detail:
          "Configure additional AI providers as backups in Settings > AI model — OpenAI, Google Gemini, and Ollama (a local model running entirely on this machine, no account or cost). If your primary provider fails for a request (billing, rate limit, outage), the app automatically falls through to the next configured one in the order you set. If all configured providers fail, the error shows every provider's real reason, not just the last one tried. Behind the scenes, simple extraction/classification tasks (deadline extraction, sensitivity screening, per-document summarization on a large matter) automatically use a faster, lower-cost model where each provider offers one — the tasks that need real legal reasoning (digests, evidence matrices, drafts, chat) always use the flagship model, so this only ever trades cost on the parts of the pipeline where it doesn't affect the quality of what you actually read.",
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
          "The search icon in the nav searches across everything at once — matter titles/clients/types, document filenames, document content (the same text used for chat, so a term buried inside a large PDF is found even if it's nowhere in the filename), chat message content, digests, drafts, and evidence matrices — with a snippet showing where the match was found and matched terms highlighted. All terms must match by default; use quotes for an exact phrase (\"show cause hearing\") or a leading minus to exclude a term (-adjourned). Save a search you'll want to run again — saved searches are personal to your account, not shared firm-wide.",
      },
      {
        slug: "audit-log",
        name: "Audit log & matter timeline",
        detail:
          "Every matter/document/chat/digest/feedback/status/invoice/email/user-management action is recorded with a timestamp and who did it — viewable app-wide at Audit log, or filtered to one matter in its Activity timeline section. Also flags duplicate document uploads (same file content uploaded twice). Bulk export/download activity — several backup downloads, a matter email with several attachments, a burst of client-portal downloads, all within the same hour by the same person — is capped and, before it's capped, produces a distinctly labelled \"Unusual bulk export/download activity flagged\" entry, so it's visible here rather than blending in with routine single-item actions. The log is tamper-evident: each entry is cryptographically chained to the one before it, so an edit or deletion made outside the app is detectable. Admins can check this any time with the \"Verify log integrity\" button on the Audit log page. If it ever reports broken and you've identified and fixed a genuine cause (not unexplained tampering), an admin can re-anchor the chain from that point — this requires typing a reason, which is then recorded permanently as the next log entry, so there's always a record of why.",
      },
      {
        slug: "analytics",
        name: "Analytics",
        detail:
          "Firm-wide metrics (nav > Analytics, admins and lawyers only — not visible to staff): matters opened/closed over the last 12 months, work-in-progress (unbilled time value across every open matter), billed vs. collected by month, top matter types, and hours logged per person over the last 90 days. That last one only counts time entries logged since attorney attribution was added to time entries — older entries stay uncounted rather than guessed at. All numbers come straight from the same matters/time-entries/invoices data you already see elsewhere; nothing here is a separate, editable record.",
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
        slug: "monitoring",
        name: "System status",
        detail: "Admin-only, reached by clicking the status dot in the sidebar (also visible to every user as a plain colour signal — green if an AI provider is configured, red if not). A live, uncached snapshot of the whole installation: app version and uptime, the audit log's hash-chain integrity, database row counts (matters, documents, users, active sessions, and more), storage sizes (database file, uploaded documents, backups) and where the encryption key lives (macOS Keychain vs. a local key file), backup history, and every integration's configured/not-configured status in one place.",
      },
      {
        slug: "appearance",
        name: "Appearance",
        detail: "Light/Dark/System theme, temperature unit, and current-weather location.",
      },
      {
        slug: "translation",
        name: "Translation",
        detail:
          "Available to every user, not just admins. Sets the language pre-selected on every Translate button throughout the app — digests, evidence/defence matrices, drafts, chat answers, independent reviews, and the smart email draft. Pick from the built-in list or enter any other language. You can still choose a different language at any time in a specific Translate button's own dropdown; this only sets what's already selected there.",
      },
      {
        slug: "privacy",
        name: "Privacy",
        detail:
          "Admin-only, firm-wide. Controls whether SIN/SSN/credit card numbers (and optionally phone numbers/email addresses) are automatically masked out of a matter's content before it's sent to any AI provider — Anthropic, OpenAI, or Google Gemini. On by default. A masked identifier is replaced with a placeholder like \"[REDACTED:SIN]\" before the request leaves this app, across chat, digests, evidence matrices, deadline extraction, drafts, the self-checking drafting agent, and independent review. Turning off an identifier (or masking entirely) trades that safety for accuracy — a draft that legitimately needs to state a real number will only do so with masking off.",
      },
      {
        slug: "integrations",
        name: "Integrations",
        detail:
          "Connect a Gmail or Microsoft (Outlook/Hotmail/Office 365) mailbox two ways: via OAuth (the provider's own real login page, then its own consent screen listing exactly what's being requested) or, for anyone who'd rather skip registering a developer app, with a simpler app password over IMAP instead — the same one-time \"generate a per-app code from your account's security settings\" step Yahoo already uses, since Yahoo has no OAuth mail-read option at all. OAuth requires an app registered with the provider (see the note in each row for the exact redirect URI to register); the app-password path needs nothing registered, just Two-Step/two-factor verification turned on first. Trade-off: an app-password connection can read mail but can't do calendar sync (no Calendar API scope) — reconnect via OAuth instead if that matters. Microsoft's app-password path only works for a personal Outlook.com/Hotmail account; a work or school Microsoft 365 account has no app-password option at all and must use OAuth. Once a Google or Microsoft account is connected via OAuth, a \"Sync deadlines to calendar\" checkbox appears — turning it on pushes rule-computed deadlines to that account's calendar automatically, plus lets any deadline be pushed manually from its matter's Deadlines tab. Calendar sync needs its own OAuth scope beyond plain mail reading: an account connected before this feature existed has to be disconnected and reconnected once for the wider consent screen to appear.",
      },
      {
        slug: "security",
        name: "Security",
        detail:
          "Change your own login password here — this page is available to every user, not just admins (or reset a forgotten one from the terminal with npm run reset-password -- you@example.com). Login is rate-limited per account after repeated failed attempts. Also available: two-factor authentication (2FA). Enabling it shows a QR code — scan it with an authenticator app (Google Authenticator, 1Password, Authy, etc.), or use the \"can't scan\" link for manual entry — then confirm with the 6-digit code it generates. From then on, logging in requires that code (or one of the 8 one-time backup codes shown right after setup — save them somewhere safe, they're not shown again) in addition to your password. Disabling 2FA requires your current password.",
      },
      {
        slug: "users",
        name: "Users",
        detail:
          "Admin-only. Add a lawyer or staff account with a role (admin/lawyer/staff) — a temporary password is shown once for you to pass along; they're required to set their own password on first login. Change anyone's role, reset a password, or deactivate an account (deactivating immediately signs them out everywhere). Every matter is visible to everyone by default; roles control access to Settings/API keys and user management, and a matter's own ethical-wall toggle (its Compliance tab) is what restricts matter visibility on a case-by-case basis — see Team assignment and Compliance above.",
      },
      {
        slug: "backup",
        name: "Backup & restore",
        detail:
          "Admin-only. \"Backup now\" saves the entire app — matters, documents, clients, users, settings — into one downloadable file; the last 10 are kept automatically. Every download is recorded in the audit log, and downloading many backups within the same hour is rate-limited (with a flagged alert before the hard limit kicks in) — a backup is the single most sensitive export this app can produce, so it's worth noticing if it happens a lot in a short window. Restoring replaces all current data with a backup's contents (current data is moved aside on disk, not deleted, but you must restart the app right after for the restore to take effect) — typing \"RESTORE\" is required to confirm. For automatic backups on a schedule, this page shows a command to wire into an OS-level scheduled task (cron on macOS/Linux, Task Scheduler on Windows) — there's no built-in scheduler. Note: the encryption key isn't included in the backup (it lives in the macOS Keychain, or a separate file on Windows/Linux) — back that up separately too, or a restored backup's secrets/documents can't be decrypted.",
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
