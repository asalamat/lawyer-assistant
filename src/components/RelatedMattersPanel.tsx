"use client";

import Link from "next/link";
import { useState } from "react";
import type { MatterSearchResult } from "@/lib/relatedMatters";
import type { RelatedMatterLink } from "@/lib/types";

export default function RelatedMattersPanel({
  matterId,
  initialLinks,
}: {
  matterId: string;
  initialLinks: RelatedMatterLink[];
}) {
  const [links, setLinks] = useState(initialLinks);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MatterSearchResult[]>([]);
  const [selected, setSelected] = useState<MatterSearchResult | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(
      `/api/matters/search?q=${encodeURIComponent(value.trim())}&exclude=${encodeURIComponent(matterId)}`,
    );
    setResults(res.ok ? await res.json() : []);
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/related`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatedMatterId: selected.id, note }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to link matter");
      setLinks((prev) => [body, ...prev]);
      setQuery("");
      setResults([]);
      setSelected(null);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlink(relatedMatterId: string) {
    setLinks((prev) => prev.filter((link) => link.matterId !== relatedMatterId));
    await fetch(`/api/matters/${matterId}/related/${relatedMatterId}`, { method: "DELETE" });
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">Related matters</h2>
      <p className="text-sm text-muted">
        Link this matter to others that share an opposing party, arise from the same incident, or
        otherwise need to be read together. Links are visible from both matters.
      </p>

      <form onSubmit={handleLink} className="flex flex-col gap-2">
        <input
          placeholder="Search matters by title or file number…"
          value={selected ? `${selected.fileNumber} — ${selected.title}` : query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="surface-input"
        />
        {!selected && results.length > 0 && (
          <ul className="flex flex-col gap-1">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(result);
                    setResults([]);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  <span className="font-medium">{result.fileNumber}</span> — {result.title}
                  <span className="ml-2 text-xs text-muted">{result.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!selected && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-muted">No other matters match that.</p>
        )}
        {selected && (
          <>
            <input
              placeholder="Why are these related? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="surface-input"
            />
            <div className="flex items-center gap-2">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Linking…" : "Link matter"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                  setNote("");
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {links.length === 0 ? (
        <p className="text-sm text-muted">No related matters linked yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.matterId} className="surface-row text-sm">
              <div className="mb-1 flex items-start justify-between gap-2">
                <Link href={`/matters/${link.matterId}`} className="text-accent hover:underline">
                  <span className="font-medium">{link.fileNumber}</span> — {link.title}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted">{link.status}</span>
                  <button
                    onClick={() => handleUnlink(link.matterId)}
                    className="text-xs text-muted hover:text-red-600"
                    aria-label={`Unlink ${link.fileNumber}`}
                  >
                    Unlink
                  </button>
                </div>
              </div>
              {link.note && <p className="whitespace-pre-wrap">{link.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
