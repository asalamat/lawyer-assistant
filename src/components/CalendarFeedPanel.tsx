"use client";

import { useState } from "react";

export default function CalendarFeedPanel({ initialSecret }: { initialSecret: string }) {
  const [secret, setSecret] = useState(initialSecret);
  const [regenerating, setRegenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/settings/calendar-feed/regenerate", { method: "POST" });
      const body = await res.json();
      if (res.ok) setSecret(body.secret);
    } finally {
      setRegenerating(false);
      setConfirming(false);
    }
  }

  const feedUrl = `https://YOUR-APP-URL/api/deadlines/feed/${secret}`;

  return (
    <div className="surface-row flex flex-col gap-3 text-sm">
      <p className="font-medium">Calendar feed — automatic, no sign-in needed</p>
      <p className="text-muted">
        Add this URL to Google Calendar, Outlook, or Apple Calendar as a <strong>subscribed
        calendar</strong> (not an import) — every current and future deadline then appears
        automatically, refreshing on its own every few hours. This needs no Google/Microsoft
        account connection at all, since it never talks to their APIs — it&apos;s the same kind of
        link a public events calendar uses.
      </p>
      <code className="block overflow-x-auto rounded bg-black/[0.04] p-2 text-xs dark:bg-white/[0.06]">
        {feedUrl}
      </code>
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        <li>
          <strong>Google Calendar</strong> (on a computer): Other calendars (+) &gt; From URL &gt;
          paste it &gt; Add calendar.
        </li>
        <li>
          <strong>Outlook</strong>: Add calendar &gt; Subscribe from web &gt; paste it &gt; Import.
        </li>
        <li>
          <strong>Apple Calendar</strong>: File &gt; New Calendar Subscription &gt; paste it &gt;
          Subscribe.
        </li>
      </ul>
      <p className="text-xs text-red-600">
        Anyone with this exact URL can see every deadline in the firm (titles and dates, not
        document contents) — don&apos;t post it anywhere public. Regenerating replaces the old URL
        everywhere it&apos;s subscribed, so you&apos;d need to re-subscribe after.
      </p>
      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs">Replace the current URL? Anywhere it&apos;s already subscribed will stop working.</span>
          <button onClick={handleRegenerate} disabled={regenerating} className="btn-secondary px-3 py-1.5 text-xs">
            {regenerating ? "Regenerating…" : "Yes, regenerate"}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs text-muted underline">
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="self-start text-xs text-muted underline decoration-muted/40"
        >
          Regenerate URL
        </button>
      )}
    </div>
  );
}
