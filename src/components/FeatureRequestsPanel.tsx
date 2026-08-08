"use client";

import { useEffect, useState } from "react";
import type { FeatureRequest, FeatureRequestStatus } from "@/lib/types";

const STATUS_LABELS: Record<FeatureRequestStatus, string> = {
  new: "New",
  planned: "Planned",
  declined: "Declined",
  done: "Done",
};

const STATUS_BADGE: Record<FeatureRequestStatus, string> = {
  new: "badge",
  planned: "badge-accent",
  declined: "badge",
  done: "badge-accent",
};

export default function FeatureRequestsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [requests, setRequests] = useState<FeatureRequest[] | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function refresh() {
    const res = await fetch("/api/feature-requests");
    if (res.ok) setRequests(await res.json());
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feature-requests")
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setRequests(body);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to submit");
      setTitle("");
      setDescription("");
      setExpanded(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, status: FeatureRequestStatus) {
    setRequests((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? prev);
    await fetch(`/api/feature-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function handleDelete(id: string) {
    await fetch(`/api/feature-requests/${id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <div className="surface-card mb-8 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg">Have an idea? Send a wish item</h2>
          <p className="text-sm text-muted">
            Anything you wish this app could do — it goes on a shared list everyone here can see,
            so a request doesn&apos;t get submitted twice.
          </p>
        </div>
        {requests && requests.length > 0 && (
          <button onClick={() => setExpanded((v) => !v)} className="btn-secondary shrink-0 px-3 py-1.5 text-sm">
            {expanded ? "Hide list" : `Show list (${requests.length})`}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you wish this app could do?"
          className="surface-input"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Any more detail (optional)"
          className="surface-input"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting || !title.trim()} className="btn-primary self-start">
          {submitting ? "Sending…" : "Send wish item"}
        </button>
      </form>

      {expanded && (
        <ul className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
          {requests?.length === 0 && <p className="text-sm text-muted">No wish items yet.</p>}
          {requests?.map((r) => (
            <li key={r.id} className="surface-row flex flex-col gap-1 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{r.title}</p>
                {isAdmin ? (
                  <select
                    value={r.status}
                    onChange={(e) => handleStatusChange(r.id, e.target.value as FeatureRequestStatus)}
                    className="surface-input shrink-0 py-1 text-xs"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`${STATUS_BADGE[r.status]} shrink-0`}>{STATUS_LABELS[r.status]}</span>
                )}
              </div>
              {r.description && <p className="text-muted">{r.description}</p>}
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  {r.userName} · {new Date(r.createdAt).toLocaleDateString()}
                </span>
                {isAdmin && (
                  <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
