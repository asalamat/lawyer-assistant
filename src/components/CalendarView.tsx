"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDateOnly } from "@/lib/formatDate";
import type { CalendarItem } from "@/lib/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Builds a 6x7 grid of ISO date strings covering the given month, padded
// with the trailing days of the previous month and leading days of the
// next so every week row is always full — simplest way to lay out a
// month view without special-casing the first/last row.
function buildMonthGrid(year: number, month: number): string[] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(year, month, 1 - startWeekday + i));
    return d.toISOString().slice(0, 10);
  });
}

export default function CalendarView({
  initialItems,
  matterId,
  matters,
}: {
  initialItems: CalendarItem[];
  matterId?: string;
  matters?: { id: string; title: string }[];
}) {
  const [items, setItems] = useState(initialItems);
  const now = useState(() => new Date())[0];
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [reminderDaysBefore, setReminderDaysBefore] = useState("1");
  const [eventMatterId, setEventMatterId] = useState(matterId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = todayIso();

  function goToMonth(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth());
    setSelectedDate(null);
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          startDate,
          matterId: eventMatterId || null,
          reminderDaysBefore: reminderDaysBefore ? Number(reminderDaysBefore) : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add event");
      setItems((prev) => [
        ...prev,
        {
          id: body.id,
          kind: "event",
          title: body.title,
          date: body.startDate,
          endDate: body.endDate,
          matterId: body.matterId,
          matterTitle: matters?.find((m) => m.id === body.matterId)?.title ?? null,
        },
      ]);
      setTitle("");
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(id: string) {
    await fetch(`/api/calendar/events/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => goToMonth(-1)} className="btn-secondary px-2 py-1 text-sm">
            ←
          </button>
          <h2 className="font-display min-w-[10rem] text-center text-lg">
            {MONTH_LABELS[month]} {year}
          </h2>
          <button onClick={() => goToMonth(1)} className="btn-secondary px-2 py-1 text-sm">
            →
          </button>
          <button
            onClick={() => {
              setYear(now.getUTCFullYear());
              setMonth(now.getUTCMonth());
            }}
            className="text-xs text-accent underline decoration-accent/40"
          >
            Today
          </button>
        </div>
        <button onClick={() => setShowAddForm((v) => !v)} className="btn-primary px-3 py-1.5 text-sm">
          {showAddForm ? "Cancel" : "Add event"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddEvent} className="surface-card flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            required
            className="surface-input"
          />
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="surface-input"
            />
            <label className="flex items-center gap-2 text-xs text-muted">
              Remind
              <input
                type="number"
                min={0}
                max={60}
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(e.target.value)}
                className="surface-input w-16"
              />
              day(s) before
            </label>
            {matters && !matterId && (
              <select
                value={eventMatterId}
                onChange={(e) => setEventMatterId(e.target.value)}
                className="surface-input"
              >
                <option value="">Firm-wide (no matter)</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary self-start px-3 py-1.5 text-sm">
            {saving ? "Saving…" : "Save event"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-card px-2 py-1.5 text-center font-medium text-muted">
            {label}
          </div>
        ))}
        {grid.map((date) => {
          const dayItems = itemsByDate.get(date) ?? [];
          const inCurrentMonth = new Date(date + "T00:00:00Z").getUTCMonth() === month;
          const isToday = date === today;
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex min-h-[4.5rem] flex-col gap-1 bg-card px-1.5 py-1 text-left transition-colors hover:bg-accent/5 ${
                inCurrentMonth ? "" : "opacity-40"
              }`}
            >
              <span className={`text-xs ${isToday ? "badge-accent w-fit px-1.5" : "text-muted"}`}>
                {Number(date.slice(8, 10))}
              </span>
              {dayItems.slice(0, 2).map((item) => (
                <span
                  key={item.id}
                  className={`truncate rounded px-1 py-0.5 text-[10px] ${
                    item.kind === "deadline" ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-accent/10 text-accent"
                  }`}
                >
                  {item.title}
                </span>
              ))}
              {dayItems.length > 2 && <span className="text-[10px] text-muted">+{dayItems.length - 2} more</span>}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="surface-card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{formatDateOnly(selectedDate)}</h3>
            <button onClick={() => setSelectedDate(null)} className="text-xs text-muted underline">
              Close
            </button>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted">Nothing on this day.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {selectedItems.map((item) => (
                <li key={item.id} className="surface-row flex items-center justify-between text-sm">
                  <div>
                    <span
                      className={`badge mr-2 ${item.kind === "deadline" ? "border-red-500/30 text-red-700 dark:text-red-400" : ""}`}
                    >
                      {item.kind === "deadline" ? "Deadline" : "Event"}
                    </span>
                    {item.title}
                    {item.matterTitle && (
                      <span className="ml-2 text-xs text-muted">
                        —{" "}
                        <Link href={`/matters/${item.matterId}`} className="underline">
                          {item.matterTitle}
                        </Link>
                      </span>
                    )}
                  </div>
                  {item.kind === "event" && (
                    <button
                      onClick={() => handleDeleteEvent(item.id)}
                      className="text-xs text-red-600 underline"
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
