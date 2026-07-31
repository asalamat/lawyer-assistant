"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Matter } from "@/lib/types";
import MatterCard from "./MatterCard";

type StatusFilter = "all" | "open" | "closed";
type SortOrder = "newest" | "oldest" | "title";

export default function MatterList({ matters }: { matters: Matter[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterType, setMatterType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const filteredMatters = matters
    .filter((matter) => {
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, clientName, matterType }),
      });
      if (!res.ok) throw new Error("Failed to create matter");
      setTitle("");
      setClientName("");
      setMatterType("");
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
        <div className="grid gap-3 sm:grid-cols-3">
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
            className="surface-input"
          />
          <input
            required
            placeholder="Matter type"
            value={matterType}
            onChange={(e) => setMatterType(e.target.value)}
            className="surface-input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary self-start">
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
