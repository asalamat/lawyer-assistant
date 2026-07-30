"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Matter } from "@/lib/types";
import MatterCard from "./MatterCard";

type StatusFilter = "all" | "open" | "closed";

export default function MatterList({ matters }: { matters: Matter[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [matterType, setMatterType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredMatters = matters.filter((matter) => {
    if (statusFilter !== "all" && matter.status !== statusFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${matter.title} ${matter.clientName} ${matter.matterType}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
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
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
      >
        <h2 className="font-medium">New matter</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            required
            placeholder="Matter title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
          />
          <input
            required
            placeholder="Client name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
          />
          <input
            required
            placeholder="Matter type"
            value={matterType}
            onChange={(e) => setMatterType(e.target.value)}
            className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create matter"}
        </button>
      </form>

      {matters.length === 0 ? (
        <p className="text-sm text-zinc-500">No matters yet.</p>
      ) : (
        <>
          <div className="flex gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, client, or type…"
              className="flex-1 rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {filteredMatters.length === 0 ? (
            <p className="text-sm text-zinc-500">No matters match your search.</p>
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
