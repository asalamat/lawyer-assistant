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
          "A board (nav > Leads) for tracking prospective clients before a matter exists — the intake questionnaire and everything else in this app assumes a matter is already open, this is the layer before that.\n\n" +
          "- Add a lead with just a name (email/source optional)\n" +
          "- Move it through **New → Contacted → Consultation scheduled → Proposal sent → Won/Lost** using the dropdown on its card or its own detail page\n" +
          "- Delete one entirely from its detail page (type **DELETE** to confirm — permanent, no undo)\n" +
          "- **\"Convert to matter\"** on the lead's detail page creates a real matter (and client, if one doesn't already exist) the same way the normal new-matter flow does — the lead's own record stays intact afterward with a link to the matter it became, marked Won automatically\n" +
          "- **\"Get embed code\"** gives an `<iframe>` snippet for the firm's own public website — a visitor who fills it in and submits lands here as a new lead automatically, tagged \"website,\" no login or app access involved on their end. That form is rate-limited per visitor to guard against spam",
      },
      {
        slug: "sticky-notes",
        name: "Sticky notes",
        detail:
          "The note icon in the bottom-right corner of every page lets you leave yourself quick reminders pinned to that specific page — a matter's Digest tab, the Dashboard, Settings, anywhere.\n\n" +
          "- Click it to drop a new note right on the page, then just start typing — it saves automatically as you go\n" +
          "- Drag a note anywhere on screen by its top bar (the color dots) to reposition it; where you leave it is remembered next time you open that page\n" +
          "- Add as many as you like per page, pick a color for each with the dots at the top of the note\n" +
          "- Click the ✕ to remove one you're done with\n" +
          "- Private to you: no one else, including other staff who open the same page, ever sees them",
      },
      {
        slug: "calendar-notifications",
        name: "Calendar & notifications",
        detail:
          "A firm-wide calendar (nav > Calendar) and a Calendar tab on every matter show the same underlying data from two angles: every deadline with a due date, plus any ad-hoc event you add directly (title, date, optional matter, optional reminder lead time in days). This is a fully native calendar — there's no Google/Microsoft account to connect and nothing external to keep in sync.\n\n" +
          "- Click a day to see its items or add a new event to it\n" +
          "- Delete an event (not a deadline — remove those from the matter's Deadlines tab instead) from the day's detail panel\n" +
          "- An hourly check looks for deadlines due tomorrow or today and events entering their reminder window, and raises a reminder through up to three channels:\n" +
          "  - The bell icon in the top bar (click to see recent reminders, mark one or all read)\n" +
          "  - An email to every active staff account, if SMTP is configured (Settings > Email)\n" +
          "  - A browser push notification on any device that opted in (Settings > Security > Browser notifications)\n" +
          "- Each reminder is only ever raised once per item, so re-checking never spams the same due date twice",
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
          "- Create a matter with a title, client name, client email, matter type, and an optional default hourly billing rate\n" +
          "- A conflict-of-interest check runs automatically against every existing client name (exact and near-miss spelling) when you fill in the client name\n" +
          "- Search/filter the matters list by text or open/closed/archived status\n" +
          "- Close, reopen, archive, or permanently delete a matter at any time from its Overview tab — a matter placed on legal hold (see Compliance below) can't be deleted until the hold is released",
      },
      {
        slug: "compliance",
        name: "Compliance",
        detail:
          "Each matter has a classification (standard/privileged/highly-sensitive), an optional retention date (informational — nothing auto-deletes on it), a legal hold toggle, and an ethical wall toggle.\n\n" +
          "- A matter on **legal hold** shows a badge in its header and can't be deleted, even from the danger zone, until the hold is released\n" +
          "- Applying an **ethical wall** restricts the matter to whoever is on its Team assignment list (see below) plus admins — everyone else is transparently redirected as if the matter didn't exist, on every page and API route, and the matter disappears from the matters list, dashboard, and search for them too\n" +
          "  - Assign the right team before applying a wall, not after, or only admins will be able to get back in\n" +
          "  - Removing the wall restores the default shared visibility immediately\n" +
          "- All changes here are recorded in the audit log\n" +
          "- While a matter is still at the default \"standard\" classification, uploading documents runs an intake agent that reads them and suggests tightening the classification if the content warrants it (privileged communications, medical/financial/highly personal details) — shown as a banner with **Apply**/**Dismiss** right where you uploaded. Nothing changes automatically, and once you've classified a matter (by accepting a suggestion or setting it manually) it stops suggesting",
      },
      {
        slug: "document-upload",
        name: "Document upload",
        detail:
          "Drag and drop files onto a matter.\n\n" +
          "- Text, PDF, Word (.docx), Excel/CSV, images (via OCR), and audio/video recordings (via OpenAI Whisper, once configured) are readable by chat and AI features — other file types still upload but aren't used as AI context\n" +
          "- Tables inside a PDF or Word document are detected and kept as a proper table (rows/columns preserved) instead of being flattened into a jumbled run of text\n" +
          "- Dropping a .zip (e.g. a disclosure package) unpacks it and uploads each file inside individually — a per-file result list shows what succeeded or failed\n" +
          "- **\"Import an email\"** (also on this page) browses a connected inbox (Gmail, Microsoft, or Yahoo — see Integrations for how each connects) and imports one or several selected messages into this matter as documents, pulling in a specific folder if you pick one from the dropdown. Real attachments come in too, each badged \"attachment of\" the email it arrived with\n" +
          "- Identical files uploaded twice are flagged as **duplicates**; near-identical content (e.g. the same letter re-scanned or re-saved) is flagged as a **near-duplicate**, based on extracted-text similarity, not file bytes\n" +
          "- A document that can't be read at all shows an **\"extraction failed\"** badge with the real error on hover and a Retry button, instead of silently vanishing from AI context\n" +
          "- A chat-readable document also shows its detected language (if not English) and a quality score when it's below 70% — usually a scanned image OCR'd with low confidence, worth a manual look\n" +
          "- An uploaded photo (.png/.jpg/.jpeg/.webp) also gets a real AI visual description — not just OCR — automatically at upload; a **\"photo analyzed\"** badge shows the description on hover, with **Analyze photo**/Retry if it hasn't run yet or failed. That description merges into the same text every chat/digest/evidence-matrix feature reads, so a photo participates the same way a text document does\n" +
          "- Every upload is scanned for malware first (local ClamAV, Settings > Privacy — no cloud account); a flagged file is quarantined instead of stored where AI features or chat can read it\n" +
          "- Documents are encrypted at rest and decrypted transparently when read\n" +
          "- If the matter has a linked client, each document shows a **\"Share with client\"** toggle — turning it on makes that document visible in the client's portal login (see Client portal below); nothing is visible by default\n" +
          "- Click **\"Similar\"** next to a chat-readable document to find related content elsewhere in the matter, ranked by similarity",
      },
      {
        slug: "notes",
        name: "Notes",
        detail:
          "- Add free-text notes or findings to a matter\n" +
          "- Dictate them with the microphone button instead of typing, if you prefer\n" +
          "- Notes are included as context for the matter digest, alongside uploaded documents",
      },
      {
        slug: "reference-library",
        name: "Reference library",
        detail:
          "Upload statutes, case law, or other reference material once (nav > Reference library), then attach whichever documents are relevant to a specific matter from that matter's Overview tab.\n\n" +
          "- Every reference document is tagged **Firm knowledge** (precedents, templates, internal know-how) or **Public legal authority** (statutes, case law) at upload — the matter attach dropdown groups by tier\n" +
          "- Attached reference documents are included in that matter's chat/digest/drafts/evidence-matrix context — attaching is per matter on purpose, so an unrelated matter doesn't get, say, the entire Criminal Code stuffed into its AI context\n" +
          "- A newly uploaded document is pending approval and can't be attached to any matter until a lawyer or admin approves it — meant to catch a client-specific document uploaded here by mistake before it becomes reusable across other clients' matters\n" +
          "- An automatic check flags text that looks like a real client's personal or privileged details (a warning to review, not an automatic block)",
      },
      {
        slug: "clients",
        name: "Clients",
        detail:
          "- Every matter is automatically linked to a client record (nav > Clients) — a second matter for the same client (same name and email) links to the same client instead of creating a duplicate\n" +
          "- A client's detail page shows their full matter history in one place\n" +
          "- Typing a client name on the new-matter form autocompletes against existing clients and fills in their email automatically once matched\n" +
          "- Clients can also be added, edited, or deleted directly from the Clients page — deleting is blocked while any matter still references that client\n" +
          "- Editing a client's name/email here also updates it on every matter already linked to them, so invoices/e-signature/compose-email always use the current address",
      },
      {
        slug: "client-portal",
        name: "Client portal",
        detail:
          "A real, persistent login for a client — not a one-time link that expires.\n\n" +
          "- On a client's detail page, under **\"Client portal access\"**, click **\"Grant portal access\"** (confirm or edit their email first) to create their account — a temporary password is shown once for you to pass along securely; they set their own on first login\n" +
          "- If access already exists, the same button becomes **\"Reset password\"** and works the same way, signing them out of any existing session\n" +
          "- The client logs in separately from staff, at `/portal/login`, and sees only their own matters and whichever documents you've turned **\"Share with client\"** on — nothing is visible by default, and a client can never see another client's matters\n" +
          "- One portal account per client\n" +
          "- A matter's own **Client messages** tab (staff side) and the client's portal page share the same real two-way message thread — no email, no SMS, just an in-app conversation either side can refresh and reply to\n" +
          "- Downloads, grants/resets, and messages are all recorded in the audit log",
      },
      {
        slug: "matter-team",
        name: "Team assignment",
        detail:
          "Record who's working a matter and in what capacity, from its Overview tab.\n\n" +
          "- Pick any active account at the firm and describe their role in your own words (\"Lead lawyer\", \"Paralegal\", \"Second chair\")\n" +
          "- Somebody can only be listed once per matter, and a deactivated account can't be assigned\n" +
          "- Assigning and removing are both recorded in the audit log\n" +
          "- This is ordinary responsibility bookkeeping by default — everyone at the firm can still see every matter — unless the matter's ethical wall (Compliance tab) is turned on, in which case this list becomes the actual access list",
      },
      {
        slug: "parties-related-matters",
        name: "Parties & related matters",
        detail:
          "A matter's Parties tab records everyone involved besides the client — opposing party, opposing counsel, witnesses, experts, insurers — with a role, optional email/phone, and notes.\n\n" +
          "- Role is free text with common roles suggested, so unusual ones (adjuster, estate trustee, translator) still fit\n" +
          "- Adding, editing, and removing a party is recorded in the audit log\n" +
          "- The same tab links this matter to other matters that share an opposing party, arise from the same incident, or otherwise need reading together — search by title or file number, add an optional note explaining the connection\n" +
          "- The link shows on both matters' Parties tabs; unlinking from either side removes it",
      },
      {
        slug: "consent-signatures",
        name: "Consent & signatures",
        detail:
          "A matter's \"Consent & signatures\" tab prepares retainer agreements, conflict waivers, privacy consents, or any other document that needs the client's signature, and tracks each one through **draft → awaiting signature → signed/declined/voided**.\n\n" +
          "- Optionally attach one of the matter's uploaded documents as the thing being signed — the signature record then stores that file's content hash, so it's provable later which exact version was agreed to\n" +
          "- **\"Send for signature\"** issues a single-purpose link (`/sign/…`): no login, no account, scoped to that one document, expires on its own after two weeks\n" +
          "- If the matter has a client email on file and SMTP is configured (Settings > Email), that link is emailed to the client automatically — the tab also shows a **\"Copy link\"** button as a backup, or for when there's no email on file\n" +
          "- The link is only shown at the moment it's issued — if it's lost, **\"Resend link\"** mints a fresh one (and re-sends the email) while the previous link stops working immediately\n" +
          "- If the client has portal login access, the pending request also shows up automatically under **\"Needs your signature\"** in their portal — nothing further to send in that case\n" +
          "- The signing page takes their typed full legal name, an optional drawn signature, and an explicit **\"I intend this as my legal signature\"** confirmation; their IP address, browser, and timestamp are recorded alongside it\n" +
          "- Mark a document **declined** (if the client says no by phone or email) or **void** it entirely — both kill any outstanding link\n" +
          "- Every step is recorded in the audit log; signatures submitted through the client link show no attributed user, since the client isn't a user of this app\n" +
          "- The same signing mechanism is also available from a matter's Document templates tab and from an invoice's **\"Request client approval\"** button on the Timesheet tab\n" +
          "- This is a basic electronic signature, not a certificate-backed qualified/advanced e-signature\n" +
          "- If **DocuSign** is configured and turned on (Settings > DocuSign), every one of these actions routes through DocuSign automatically instead — DocuSign emails the client and hosts the entire signing ceremony on its own site, so there's no copy-link step and no local `/sign/…` link at all. That's specifically for setups where this app has no public URL of its own — DocuSign only needs outbound access to its API. Status updates (signed/declined/voided) come back via a background check every few minutes, not instantly, since there's no webhook endpoint for DocuSign to call",
      },
      {
        slug: "intake-questionnaires",
        name: "Intake questionnaires",
        detail:
          "A matter's Intake tab sends the client a no-login link (`/intake/…`) to a fixed intake questionnaire.\n\n" +
          "- Covers: full legal name, contact details and preference, how they found the firm, a description of the matter in their own words, whether another lawyer was previously retained on it, dates/deadlines they know about, and what documents they already hold\n" +
          "- The question set is the same for every matter and isn't configurable, so answers stay comparable across files\n" +
          "- The link is scoped to that one questionnaire, works for a single submission, and expires on its own after two weeks\n" +
          "- Copy it from the tab and send it however you normally reach the client — it's only shown at the moment it's issued, so send another questionnaire if it's lost\n" +
          "- The client's page shows nothing about the matter itself (no title, file number, or documents), just the questions\n" +
          "- Once submitted the tab shows their answers inline with a **Completed** badge; sending and completion are both recorded in the audit log",
      },
      {
        slug: "timesheet-invoicing",
        name: "Timesheet & invoicing",
        detail:
          "- Log time against a matter, set one default hourly rate per matter\n" +
          "- Select unbilled entries to generate an invoice with an optional discount\n" +
          "- Track paid/unpaid status\n" +
          "- Email the invoice to the client (once SMTP is configured in Settings) or open it as a draft in your own mail client\n" +
          "- **\"Request client approval\"** sends a signing link (or routes through DocuSign, if configured) for the client to explicitly approve an invoice — see Consent & signatures above for how signing works",
      },
      {
        slug: "tasks",
        name: "Tasks",
        detail:
          "A matter's Tasks tab is a plain checklist for free-form to-dos — \"draft motion,\" \"call client\" — separate from Deadlines, which only ever holds actual dates.\n\n" +
          "- Add a task with just a title, or optionally a due date and an assignee from anyone active at the firm\n" +
          "- Checking it off records when it was completed; deleting removes it outright, no undo\n" +
          "- Any task assigned to you, across every matter you can see, rolls up into a \"My tasks\" widget on the Dashboard, the same way upcoming deadlines do",
      },
      {
        slug: "trust-accounting",
        name: "Trust accounting",
        detail:
          "Bookkeeping support for client trust funds (nav > Trust accounting) — not accounting or tax advice; verify against your bar's own trust-accounting rules.\n\n" +
          "- Admins/lawyers create one or more trust accounts\n" +
          "- A matter's own Trust tab records deposits, withdrawals, and transfers to your operating account against whichever trust account holds its funds, and shows a running balance computed fresh from that history every time — never a stored number that could drift\n" +
          "- A withdrawal or transfer that would take a matter's balance negative is rejected outright — one client's funds are never used to cover another's shortfall\n" +
          "- From the main Trust accounting page, **\"Reconcile\"** compares an account's ledger total against a bank statement balance you enter, recording the comparison (and any variance) permanently, whether or not it matches\n" +
          "- Every deposit, withdrawal, transfer, and reconciliation is in the audit log",
      },
      {
        slug: "email",
        name: "Email",
        detail:
          "Compose and send an email directly from a matter once SMTP is configured in Settings.\n\n" +
          "- **Smart draft** describes what the email should say and gets a grounded subject+body draft citing the matter documents it's based on — always review before sending\n" +
          "- Translate the message into another language right in the compose box (defaults to Settings > Translation), replacing the draft in place\n" +
          "- Attach any of the matter's own uploaded documents when sending\n" +
          "- To bring a message FROM a connected inbox INTO this matter instead, see **\"Import an email\"** on the Overview tab — that's the opposite direction (in, not out), so it lives with the rest of document intake rather than here",
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
          "Ask questions grounded in that matter's uploaded documents and notes — dictate the question instead of typing if you prefer.\n\n" +
          "- Retrieves the most relevant passages from your documents (rather than dumping every document into every question), so it stays accurate and fast even on matters with a large volume of material\n" +
          "- Citations include a page number when the source is a PDF, e.g. \"(file.pdf, p. 4)\"\n" +
          "- Any filename cited is checked against the matter's real documents — an unverified citation is flagged in the answer\n" +
          "- Rate answers with a thumbs up/down, translate an answer (or its independent review), export it as PDF, or request an independent second-opinion review from OpenAI (requires an OpenAI key in Settings)",
      },
      {
        slug: "matter-digest",
        name: "Matter digest",
        detail:
          "Generates an executive summary: parties, key dates, facts, evidence inventory, and open questions — all cited to source documents and notes.\n\n" +
          "- Citations are checked against the matter's real documents; anything that doesn't match is flagged in a banner rather than trusted blindly\n" +
          "- Renders as proper formatted text (real headings and lists, not literal \"##\"/\"-\" characters)\n" +
          "- Use **Translate** for a copy in another language, or **Export PDF** to open a clean, printable copy in a new tab\n" +
          "- Navigating away mid-generation never stops it — it keeps running and saves normally; coming back shows \"Generating…\" and picks up the finished result automatically rather than letting you start a second one\n" +
          "- Every other AI analysis below (evidence matrix, contradictions, exhibit list, disclosure checklist, Crown position, privilege review) behaves the same way",
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
          "Scans this matter's documents and notes for Canadian neutral case citations (e.g. \"2020 ONCA 123\") and looks each one up on CanLII: whether it's a real, findable decision, plus its cited/citing cases and cited legislation (a \"note-up\").\n\n" +
          "- Only the standard neutral-citation format is detected — citations written another way won't be picked up\n" +
          "- Re-checking replaces the previous results; this isn't a history\n" +
          "- Requires a CanLII key in Settings",
      },
      {
        slug: "deadlines",
        name: "Deadlines",
        detail:
          "Extracts genuine deadlines, court dates, and limitation periods from uploaded documents.\n\n" +
          "- Runs automatically right after a new document is uploaded (single file, bulk ZIP, or email import) — a \"Found N new deadline(s)\" note appears where you uploaded\n" +
          "- Re-extracting (manual or automatic) replaces only the AI-extracted portion of the list — deadlines you calculated or added by hand (tagged \"Rule-computed\"/\"Manual\") always survive\n" +
          "- **\"Calculate a deadline\"** lets you pick a saved rule (Settings > Deadline rules, admin-only) and the date it triggers from — e.g. \"21 business days after service\" — correctly skipping weekends and any configured holiday\n" +
          "- This is a firm-editable rule library, not a licensed jurisdiction rules database — you're responsible for keeping rules and holidays accurate for your own practice\n" +
          "- Upcoming deadlines across all matters also show on the Dashboard\n" +
          "- Every deadline with a due date appears automatically on this app's own calendar (firm-wide `/calendar` and this matter's Calendar tab) — no external account or sync step needed\n" +
          "- **\"Export to personal calendar\"** downloads a one-time .ics file for a single deadline if you also want it in your own phone/desktop calendar app\n" +
          "- Reminders for upcoming and overdue deadlines show up in the notification bell, by email, and (if enabled in Settings > Security) as a browser push notification",
      },
      {
        slug: "evidence-matrix",
        name: "Evidence matrix",
        detail:
          "Maps allegations/charges to the elements that must be proven, the supporting evidence for each, and evidentiary gaps. Does not predict outcomes.\n\n" +
          "- Citations are checked against the matter's real documents; anything that doesn't match is flagged\n" +
          "- Translate it or export as PDF like any other generated document\n" +
          "- Once generated, click **Visualize** to see it as a node graph — parties, allegations, evidence, and gaps, with their connections\n" +
          "- Click any node to highlight just its direct connections, or use the checkboxes to show/hide a whole category",
      },
      {
        slug: "evidence-connections",
        name: "Evidence connections",
        detail:
          "Unlike Evidence matrix's graph (which visualizes an already-generated matrix), this reads the matter's documents directly and maps how each one connects to an allegation — corroborates, contradicts, or is missing for it — with the actual relationship labeled on each connection.\n\n" +
          "- A photo's AI-generated visual description participates the same way a text document does, so a photo can show up connected to the allegation it supports or contradicts\n" +
          "- Click **Visualize** to build it; click any node to highlight just its direct connections",
      },
      {
        slug: "contradictions",
        name: "Contradictions",
        detail:
          "Compares witness statements and other documents for genuine inconsistencies — dates, locations, amounts, and identity/description details — with both sides of each conflict quoted and cited.\n\n" +
          "- Normal variation (different wording, different level of detail) is deliberately not flagged; only real conflicts are\n" +
          "- Citations are checked against the matter's real documents; anything that doesn't match is flagged",
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
          "Compares what's actually been disclosed against what the documents themselves reference as existing — e.g. a report that mentions a recording that isn't itself among the uploaded documents.\n\n" +
          "- Only flags something as missing if a document in the matter actually references it — never assumes something should exist just because it's typical for a case like this\n" +
          "- Citations are checked against the matter's real documents; anything that doesn't match is flagged",
      },
      {
        slug: "crown-position",
        name: "Crown position",
        detail:
          "Analyzes charges and statutory elements, available evidence for each, weaknesses, possible defences, and aggravating/mitigating factors — then ends with two or three plausible Crown positions, each with supporting evidence, what's missing, and a confidence level (high/medium/low).\n\n" +
          "- Deliberately does not predict which one will happen, give a percentage, or present this as advice — a structured starting point for the lawyer's own judgment\n" +
          "- Citations are checked against the matter's real documents; anything that doesn't match is flagged",
      },
      {
        slug: "missing-evidence",
        name: "Missing evidence",
        detail:
          "Rolls up the missing-document/evidentiary-gap items already flagged by whichever of Digest, Disclosure checklist, Evidence matrix, and Crown position have been generated for this matter — one list instead of checking four tabs separately.\n\n" +
          "- Extracts only what those analyses already state as missing or referenced-but-not-provided — doesn't re-read the matter's documents or introduce a new opinion\n" +
          "- Generate at least one of those four first",
      },
      {
        slug: "privilege-review",
        name: "Privilege & redaction review",
        detail:
          "Reviews each of the matter's documents individually (not summarized, so exact wording is preserved) for solicitor-client privileged communications/work product, and sensitive personal information beyond what's already automatically masked (SIN/SSN/credit card numbers, phone, email) — medical/psychiatric details, financial account specifics, information about a minor, immigration status, and similar.\n\n" +
          "- Each finding quotes the exact passage as a redaction candidate, tagged **[PRIVILEGE]** or **[SENSITIVE]**\n" +
          "- This is a review aid, not a final privilege determination — always reviewed by a lawyer before anything is actually redacted or withheld\n" +
          "- Citations are checked against the matter's real documents; anything that doesn't match is flagged",
      },
      {
        slug: "redline",
        name: "Redline",
        detail:
          "Compares an uploaded contract against the firm's own clause playbook (Settings > Clause library — preferred, fallback, and unacceptable language per clause type, e.g. \"Limitation of liability\").\n\n" +
          "- Reports, per playbook entry: matches preferred language, falls back to something acceptable, conflicts with unacceptable language, or doesn't address that clause type at all\n" +
          "- Needs at least one clause library entry to run against — grounded only in the matter's own uploaded documents, quoting the contract's actual language\n" +
          "- Produces a structured analysis to review, not an automatically redlined/track-changes Word file — a lawyer still decides what gets changed\n" +
          "- Citations are checked against the matter's real documents; anything that doesn't match is flagged",
      },
      {
        slug: "drafting",
        name: "Drafting",
        detail:
          "Generates a first-draft research memo, demand letter, client correspondence, or defence strategy memo grounded in matter documents, with page-number citations for PDF sources.\n\n" +
          "- The defence strategy memo covers the opposing case, its weaknesses, viable defence theories ranked by evidentiary support, procedural issues worth raising, and recommended next investigative steps\n" +
          "- Dictate your instructions instead of typing, if you prefer\n" +
          "- Unsupported sections are marked for lawyer input rather than invented — always a draft for review, never a final document\n" +
          "- **Export PDF** opens a clean, printable copy in a new tab\n" +
          "- Once a defence strategy memo exists, click **Visualize** on the Defence graph below it — same click-to-focus and type-filter controls as the Evidence matrix graph\n" +
          "- Check **\"Self-checking (agent)\"** before generating for this app's first agentic feature: it drafts, then actively searches the matter's own documents to double-check its own citations, and revises itself (up to two rounds) if it finds one that doesn't hold up. Slower and needs an Anthropic API key specifically (no OpenAI fallback). Click **\"Agent trace\"** on any draft it produced to see exactly what it searched for and why it revised, step by step\n" +
          "- For routine documents where an AI draft is overkill — a standard retainer letter, a form notice — see Templates below instead",
      },
      {
        slug: "document-templates",
        name: "Templates",
        detail:
          "For routine documents you send the same way every time — a standard retainer letter, a form notice — instead of an AI draft from scratch.\n\n" +
          "- Anyone can author a reusable template (Settings > Document templates) as plain text with `{{field}}` placeholders — `matter.title`, `matter.fileNumber`, `matter.matterType`, `matter.clientName`, `client.email`, `client.phone`, `today`, and `lawyerName` fill in automatically; anything else becomes a field you type a value for\n" +
          "- A matter's own Templates tab picks a template, prompts for just the custom fields it needs, and generates a filled-in copy in seconds\n" +
          "- Translate it, export as PDF or a real .docx file, or **\"Save as document\"** to add it to the matter's own document list\n" +
          "- **\"Send for signature\"** saves it and sends it for signature in one action — see Consent & signatures above\n" +
          "- Deleting a template later doesn't remove documents already generated from it — each one is a complete, standalone copy",
      },
      {
        slug: "ai-redundancy",
        name: "AI provider redundancy",
        detail:
          "Configure additional AI providers as backups in Settings > AI model — OpenAI, Google Gemini, and Ollama (a local model running entirely on this machine, no account or cost).\n\n" +
          "- If your primary provider fails for a request (billing, rate limit, outage), the app automatically falls through to the next configured one in the order you set\n" +
          "- If all configured providers fail, the error shows every provider's real reason, not just the last one tried\n" +
          "- Simple extraction/classification tasks (deadline extraction, sensitivity screening, per-document summarization) automatically use a faster, lower-cost model where a provider offers one — tasks needing real legal reasoning (digests, evidence matrices, drafts, chat) always use the flagship model",
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
          "The search icon in the nav searches across everything at once — matter titles/clients/types, document filenames, document content, chat message content, digests, drafts, and evidence matrices — with a snippet showing where the match was found and matched terms highlighted.\n\n" +
          "- All terms must match by default\n" +
          "- Use quotes for an exact phrase (`\"show cause hearing\"`) or a leading minus to exclude a term (`-adjourned`)\n" +
          "- Save a search you'll want to run again — saved searches are personal to your account, not shared firm-wide",
      },
      {
        slug: "audit-log",
        name: "Audit log & matter timeline",
        detail:
          "Every matter/document/chat/digest/feedback/status/invoice/email/user-management action is recorded with a timestamp and who did it — viewable app-wide at Audit log, or filtered to one matter in its Activity timeline.\n\n" +
          "- Also flags duplicate document uploads (same file content uploaded twice)\n" +
          "- Bulk export/download activity — several backup downloads, a matter email with several attachments, a burst of client-portal downloads, all within the same hour by the same person — is capped and produces a distinctly labelled \"Unusual bulk export/download activity flagged\" entry\n" +
          "- The log is tamper-evident: each entry is cryptographically chained to the one before it, so an edit or deletion made outside the app is detectable\n" +
          "- Admins can check this any time with **\"Verify log integrity\"** on the Audit log page\n" +
          "- If it ever reports broken and you've identified and fixed a genuine cause (not unexplained tampering), an admin can re-anchor the chain from that point — this requires typing a reason, which is recorded permanently as the next log entry",
      },
      {
        slug: "analytics",
        name: "Analytics",
        detail:
          "Firm-wide metrics (nav > Analytics, admins and lawyers only — not visible to staff): matters opened/closed, work-in-progress (unbilled time value across every open matter), billed vs. collected by month, top matter types, and hours logged per person.\n\n" +
          "- Defaults to the last 12 months (90 days for hours) — the Filters section narrows any of it to a custom date range and/or a specific matter type\n" +
          "- **\"Save this report\"** keeps a filter combination you'll want to re-run later, personal to your account\n" +
          "- Hours-per-person only counts time entries logged since attorney attribution was added — older entries stay uncounted rather than guessed at\n" +
          "- All numbers come straight from the same matters/time-entries/invoices data you already see elsewhere",
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
          "Configure a CanLII API key to enable case-law lookup, citation history, and legislation watches.\n\n" +
          "- Add a specific statute/regulation to watch for repeal-status, effective-date, or section-structure changes (CanLII's API doesn't expose statute text, so in-place wording amendments can't be detected)\n" +
          "- Check manually, or set up an OS-level cron job against the check-all endpoint using the auto-generated cron secret shown on this page",
      },
      {
        slug: "email-smtp",
        name: "Email (SMTP)",
        detail: "Configure an outgoing SMTP mail server so the app can send invoices and matter email directly to clients.",
      },
      {
        slug: "docusign",
        name: "DocuSign",
        detail:
          "Admin-only, and optional — this app's own e-signature system (Consent tab, Document templates, invoice approval) already works with no setup at all. Turn this on only if you specifically want DocuSign instead: it emails the client directly and hosts the entire signing ceremony on its own site, which is the only way signing can work if this app has no public URL of its own (running on one local machine).\n\n" +
          "**Setup, step by step:**\n\n" +
          "1. Sign in to your DocuSign developer/sandbox account and go to `https://admindemo.docusign.com/api-integrator-key` — use this exact demo-environment URL, not `account.docusign.com` or `admin.docusign.com` (those manage a separate production app registration)\n" +
          "2. Find or create an app there and copy its **Integration Key**\n" +
          "3. Click **\"Generate RSA\"** — copy the **private** key (`-----BEGIN RSA PRIVATE KEY-----`), not the public key (`-----BEGIN PUBLIC KEY-----`)\n" +
          "4. Under **\"Additional settings\"**, click **\"Add URI\"** (a button that adds a new empty box specifically for a redirect URI — don't type into the nearby \"Link to Privacy Policy\"/\"Link to Terms of Use\" fields), enter `https://www.docusign.com` into that new box, click the page's own **Save**/**Update**, and reload the page to confirm it's still listed\n" +
          "5. Copy the **User ID** and **Account ID** shown under \"My Account Information\" in the same DocuSign account\n" +
          "6. Back in this app: enter the Integration Key, User ID, Account ID, and private key here, check **\"Route e-signature requests through DocuSign\"**, and Save\n" +
          "7. Open the one-time **admin-consent URL** this page then shows, in a browser while logged into the same DocuSign account, and click **Allow** — a one-time step per integration key (\"There are no redirect URIs registered\" here means step 4 didn't actually save)\n" +
          "8. Click **\"Test connection\"** to confirm everything resolves correctly\n\n" +
          "Once enabled, sending flips automatically for every existing e-signature action — no per-document choice needed. Since this app has no inbound URL for DocuSign to notify directly, a background check every 5 minutes (not instant) looks for newly completed envelopes and pulls the signed document back in. A change to that polling logic itself needs a full app restart to take effect, not just a page refresh, since it runs as a long-lived background timer rather than something reloaded per request.",
      },
      {
        slug: "software-updates",
        name: "Software updates",
        detail: "Checks this installation's git commit against the latest on GitHub and can pull updates in place.",
      },
      {
        slug: "monitoring",
        name: "System status",
        detail:
          "Admin-only, reached by clicking the status dot in the sidebar (also visible to every user as a plain colour signal — green if an AI provider is configured, red if not).\n\n" +
          "A live, uncached snapshot of the whole installation:\n" +
          "- App version and uptime\n" +
          "- The audit log's hash-chain integrity\n" +
          "- Database row counts (matters, documents, users, active sessions, and more)\n" +
          "- Storage sizes (database file, uploaded documents, backups) and where the encryption key lives (macOS Keychain vs. a local key file)\n" +
          "- Backup history\n" +
          "- Every integration's configured/not-configured status, in one place",
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
          "Available to every user, not just admins. Sets the language pre-selected on every Translate button throughout the app — digests, evidence/defence matrices, drafts, chat answers, independent reviews, and the smart email draft.\n\n" +
          "- Pick from the built-in list or enter any other language\n" +
          "- You can still choose a different language at any time in a specific Translate button's own dropdown; this only sets what's already selected there",
      },
      {
        slug: "privacy",
        name: "Privacy",
        detail:
          "Admin-only, firm-wide. Controls whether SIN/SSN/credit card numbers (and optionally phone numbers/email addresses) are automatically masked out of a matter's content before it's sent to any AI provider — Anthropic, OpenAI, or Google Gemini. On by default.\n\n" +
          "- A masked identifier is replaced with a placeholder like `[REDACTED:SIN]` before the request leaves this app, across chat, digests, evidence matrices, deadline extraction, drafts, the self-checking drafting agent, and independent review\n" +
          "- Turning off an identifier (or masking entirely) trades that safety for accuracy — a draft that legitimately needs to state a real number will only do so with masking off",
      },
      {
        slug: "integrations",
        name: "Integrations",
        detail:
          "Connect a Gmail or Microsoft (Outlook/Hotmail/Office 365) mailbox two ways:\n\n" +
          "- **OAuth** — the provider's own real login page, then its own consent screen listing exactly what's being requested. Requires an app registered with the provider (see the note in each row for the exact redirect URI to register)\n" +
          "- **App password over IMAP** — for anyone who'd rather skip registering a developer app: the same one-time \"generate a per-app code from your account's security settings\" step Yahoo already uses (Yahoo has no OAuth mail-read option at all). Needs nothing registered, just Two-Step/two-factor verification turned on first\n\n" +
          "This connection is mail-only in both cases — deadlines and events live in this app's own calendar, not in Gmail/Outlook, so there's no calendar scope or sync step to configure here at all. Microsoft's app-password path only works for a personal Outlook.com/Hotmail account; a work or school Microsoft 365 account has no app-password option and must use OAuth.",
      },
      {
        slug: "api-webhooks",
        name: "API & webhooks",
        detail:
          "Admin-only.\n\n" +
          "- **\"Generate key\"** creates an API key for an external tool to read/write leads and matters directly — sent as a Bearer token (`Authorization: Bearer <key>`) against `/api/v1/leads` and `/api/v1/matters`, entirely separate from the staff login session. The real key is shown exactly once at creation; only a hash is stored afterward\n" +
          "- **\"Revoke\"** disables a key immediately without deleting its history\n" +
          "- **Webhooks** notify an external URL when a lead or matter is created — pick the event type, paste in a URL (Zapier, n8n, or anything else that can receive a POST), and a signing secret is shown once so the receiving end can verify a delivery actually came from here (an `X-Signature` header, HMAC-SHA256 of the request body)\n" +
          "- Delivery is best-effort: a failure on the receiving end never blocks or retries, and there's no delivery log in this first version",
      },
      {
        slug: "campaigns",
        name: "Marketing campaigns",
        detail:
          "Admin-only, requires SMTP configured in Settings > Email. An email sequence (one or more steps, each with its own delay in days and its own subject/body) that auto-enrolls a lead the moment it reaches a chosen stage.\n\n" +
          "- E.g. every lead marked \"Contacted\" gets a 3-email drip over two weeks, no manual step needed\n" +
          "- A lead already enrolled in a campaign won't be enrolled in the same one twice; the Leads board shows which campaign (if any) a lead is currently in\n" +
          "- `{{lead.name}}`, `{{lead.email}}`, `{{lead.phone}}`, and `{{lead.source}}` fill in automatically in a step's subject or body\n" +
          "- Sending isn't automatic — this page shows a command to wire into an OS-level cron job (hourly is reasonable) that finds and sends whatever's currently due\n" +
          "- A lead with no email address, or a send that fails, is skipped without stopping the rest of that run",
      },
      {
        slug: "security",
        name: "Security",
        detail:
          "Available to every user, not just admins.\n\n" +
          "- Change your own login password here (or reset a forgotten one from the terminal with `npm run reset-password -- you@example.com`)\n" +
          "- Login is rate-limited per account after repeated failed attempts\n" +
          "- **Two-factor authentication (2FA)**: enabling it shows a QR code — scan it with an authenticator app (Google Authenticator, 1Password, Authy, etc.), or use the \"can't scan\" link for manual entry — then confirm with the 6-digit code it generates\n" +
          "- From then on, logging in requires that code (or one of the 8 one-time backup codes shown right after setup — save them somewhere safe, they're not shown again) in addition to your password\n" +
          "- Disabling 2FA requires your current password",
      },
      {
        slug: "users",
        name: "Users",
        detail:
          "Admin-only.\n\n" +
          "- Add a lawyer or staff account with a role (admin/lawyer/staff) — a temporary password is shown once; they're required to set their own on first login\n" +
          "- Change anyone's role, reset a password, or deactivate an account (deactivating immediately signs them out everywhere)\n" +
          "- Every matter is visible to everyone by default; roles control access to Settings/API keys and user management, and a matter's own ethical-wall toggle is what restricts matter visibility case by case (see Team assignment and Compliance above)",
      },
      {
        slug: "backup",
        name: "Backup & restore",
        detail:
          "Admin-only.\n\n" +
          "- **\"Backup now\"** saves the entire app — matters, documents, clients, users, settings — into one downloadable file; the last 10 are kept automatically\n" +
          "- Every download is recorded in the audit log, and downloading many backups within the same hour is rate-limited with a flagged alert before the hard limit\n" +
          "- **Restoring** replaces all current data with a backup's contents (current data is moved aside on disk, not deleted, but you must restart the app right after for the restore to take effect) — typing **RESTORE** is required to confirm\n" +
          "- **\"Restore from a file\"** does the same from any backup `.tar.gz` on this computer's filesystem, not just the ones kept in the list above\n" +
          "- Two independent automatic-backup mechanisms run inside the app itself, no cron job required: a fixed-interval schedule (e.g. hourly), and an activity-triggered one that waits for a configurable quiet period after real changes before backing up, capped by a minimum cooldown. Either or both can be on\n" +
          "- **Cloud storage** is optional and provider-agnostic: any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO), Google Drive or OneDrive via OAuth, or **rclone** — the only path needing zero app registration at all. An in-app setup wizard drives rclone's own OAuth flow end to end, including installing rclone itself if missing. Google Drive/OneDrive backups only ever touch a dedicated folder they create themselves\n" +
          "- The encryption key isn't included in the backup (it lives in the macOS Keychain, or a separate file on Windows/Linux) — back that up separately too, or a restored backup's secrets/documents can't be decrypted",
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
