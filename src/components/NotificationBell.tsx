"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/formatDate";
import type { AppNotification } from "@/lib/types";
import { BellIcon } from "./icons";

export default function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Inlined .then() chain rather than a named async function in the
    // effect body — react-hooks/set-state-in-effect flags the latter even
    // when the actual setState happens after an await (same pattern used
    // elsewhere in this app, e.g. IntegrationsPanel.tsx).
    function refresh() {
      fetch("/api/notifications")
        .then((res) => res.json())
        .then((body) => {
          setItems(body.items ?? []);
          setUnreadCount(body.unreadCount ?? 0);
        })
        .catch(() => {
          // Best-effort — a failed poll just leaves the last-known state showing.
        });
    }
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function handleMarkRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    await fetch("/api/notifications/read-all", { method: "POST" });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-foreground/75 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
      >
        <BellIcon className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="surface-card absolute right-0 top-10 z-20 flex max-h-96 w-80 flex-col gap-2 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="font-medium">Notifications</p>
              {unreadCount > 0 && (
                <button onClick={handleMarkAllRead} className="text-xs text-accent underline decoration-accent/40">
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted">Nothing yet.</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`surface-row flex flex-col gap-0.5 text-xs ${n.readAt ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.readAt && (
                      <button onClick={() => handleMarkRead(n.id)} className="shrink-0 text-accent underline">
                        Mark read
                      </button>
                    )}
                  </div>
                  <p className="text-muted">{n.body}</p>
                  <p className="text-muted">{formatDateTime(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
