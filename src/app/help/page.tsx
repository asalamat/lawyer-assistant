const SECTIONS = [
  {
    title: "Matters",
    items: [
      {
        name: "Create & manage matters",
        detail:
          "Create a matter with a title, client name, and matter type. Search/filter the matters list by text or open/closed status. Close or reopen a matter at any time from its detail page.",
      },
      {
        name: "Document upload",
        detail:
          "Drag and drop files onto a matter. Text, PDF, Word (.docx), and images (via OCR) are readable by chat and AI features — other file types still upload but aren't used as AI context. Identical files uploaded twice are flagged as duplicates.",
      },
    ],
  },
  {
    title: "AI features (per matter)",
    items: [
      {
        name: "Chat",
        detail:
          "Ask questions grounded only in that matter's uploaded documents. Any filename Claude cites is checked against the matter's real documents — an unverified citation is flagged in the answer. Rate answers with a thumbs up/down for later review.",
      },
      {
        name: "Matter digest",
        detail:
          "Generates an executive summary: parties, key dates, facts, evidence inventory, and open questions — all cited to source documents.",
      },
      {
        name: "Deadlines",
        detail:
          "Extracts genuine deadlines, court dates, and limitation periods from uploaded documents. Re-extracting replaces the list with a fresh read of current documents. Upcoming deadlines across all matters also show on the Dashboard.",
      },
      {
        name: "Evidence matrix",
        detail:
          "Maps allegations/charges to the elements that must be proven, the supporting evidence for each, and evidentiary gaps. Does not predict outcomes.",
      },
      {
        name: "Drafting",
        detail:
          "Generates a first-draft research memo, demand letter, or client correspondence grounded in matter documents. Unsupported sections are marked for lawyer input rather than invented — always a draft for review, never a final document.",
      },
    ],
  },
  {
    title: "Oversight",
    items: [
      {
        name: "Audit log",
        detail:
          "Every matter/document/chat/digest/feedback/status action is recorded with a timestamp, viewable at Audit log.",
      },
      {
        name: "Dashboard system info",
        detail: "Shows the app version, current git commit, Node/Next.js versions, and database size/row counts.",
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        name: "AI model",
        detail: "Configure the Anthropic API key used for all AI features. Takes effect immediately, no restart needed.",
      },
      {
        name: "Software updates",
        detail: "Checks this installation's git commit against the latest on GitHub and can pull updates in place.",
      },
      {
        name: "Appearance",
        detail: "Light/Dark/System theme, and other display preferences.",
      },
      {
        name: "Security",
        detail: "Change your login password (or reset a forgotten one from the terminal with npm run reset-password).",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Help</h1>
        <p className="mt-1 text-sm text-zinc-500">
          What this app can do today. Updated as features are added — if something
          you use isn&apos;t listed here, it&apos;s a documentation gap, not a hidden feature.
        </p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="mb-3 text-lg font-medium">{section.title}</h2>
          <div className="flex flex-col gap-3">
            {section.items.map((item) => (
              <div
                key={item.name}
                className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10"
              >
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
