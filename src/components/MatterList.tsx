"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Matter } from "@/lib/types";
import type { ConflictMatch } from "@/lib/matters";
import MatterCard from "./MatterCard";

type StatusFilter = "all" | "open" | "closed" | "archived";
type SortOrder = "newest" | "oldest" | "title";

export default function MatterList({ matters }: { matters: Matter[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [matterType, setMatterType] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [conflicts, setConflicts] = useState<ConflictMatch[]>([]);
  const [conflictsChecked, setConflictsChecked] = useState(false);
  const [acknowledgeConflict, setAcknowledgeConflict] = useState(false);

  const filteredMatters = matters
    .filter((matter) => {
      if (statusFilter === "all" && matter.status === "archived") return false;
      if (statusFilter !== "all" && matter.status !== statusFilter) return false;
      if (!query.trim()) return true;
      const haystack = `${matter.title} ${matter.clientName} ${matter.matterType}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => {
      if (sortOrder === "title") return a.title.localeCompare(b.title);
      if (sortOrder === "oldest") return a.createdAt.localeCompare(b.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });

  async function handleClientNameBlur() {
    setConflictsChecked(false);
    setAcknowledgeConflict(false);
    if (!clientName.trim()) {
      setConflicts([]);
      return;
    }
    const res = await fetch(
      `/api/matters/conflicts?clientName=${encodeURIComponent(clientName.trim())}`,
    );
    const matches: ConflictMatch[] = res.ok ? await res.json() : [];
    setConflicts(matches);
    setConflictsChecked(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (conflicts.length > 0 && !acknowledgeConflict) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, clientName, clientEmail, matterType, hourlyRate }),
      });
      if (!res.ok) throw new Error("Failed to create matter");
      setTitle("");
      setClientName("");
      setClientEmail("");
      setMatterType("");
      setHourlyRate("");
      setConflicts([]);
      setConflictsChecked(false);
      setAcknowledgeConflict(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleCreate} className="surface-card flex flex-col gap-3">
        <h2 className="font-display text-lg">New matter</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Matter title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="surface-input"
          />
          <input
            required
            placeholder="Client name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            onBlur={handleClientNameBlur}
            className="surface-input"
          />
          <input
            type="email"
            placeholder="Client email (for invoices)"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className="surface-input"
          />
          <input
            required
            placeholder="Matter type"
            value={matterType}
            onChange={(e) => setMatterType(e.target.value)}
            className="surface-input"
          />
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Default hourly rate ($, optional)"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            className="surface-input"
          />
        </div>
        {conflictsChecked && conflicts.length > 0 && (
          <div className="surface-row border-amber-500/40 bg-amber-500/10 text-sm">
            <p className="font-medium">
              Possible conflict of interest: this client name matches {conflicts.length}{" "}
              existing matter{conflicts.length > 1 ? "s" : ""}.
            </p>
            <ul className="mt-1 list-inside list-disc text-muted">
              {conflicts.map((c) => (
                <li key={c.matterId}>
                  {c.matterTitle} ({c.fileNumber}) &middot; client on file: {c.matchedOn}
                  {c.matchType === "similar-name" && (
                    <span className="ml-1 text-xs italic">(similar spelling, not exact)</span>
                  )}
                </li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={acknowledgeConflict}
                onChange={(e) => setAcknowledgeConflict(e.target.checked)}
              />
              I&apos;ve reviewed this and confirm there is no conflict of interest.
            </label>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || (conflicts.length > 0 && !acknowledgeConflict)}
          className="btn-primary self-start"
        >
          {submitting ? "Creating…" : "Create matter"}
        </button>
      </form>

      {matters.length === 0 ? (
        <p className="text-sm text-muted">No matters yet.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, client, or type…"
              className="surface-input flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="surface-input sm:w-40"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="surface-input sm:w-40"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>

          {filteredMatters.length === 0 ? (
            <p className="text-sm text-muted">No matters match your search.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredMatters.map((matter) => (
                <MatterCard key={matter.id} matter={matter} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
