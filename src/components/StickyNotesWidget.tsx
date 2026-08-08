"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isChromelessRoute } from "@/lib/chromelessRoutes";
import { STICKY_NOTE_COLORS, type StickyNote, type StickyNoteColor } from "@/lib/types";
import { StickyNoteIcon } from "./icons";

// Real sticky-note colors, deliberately not the app's own palette — a note
// should read as a physical object stuck on the page, not as another piece
// of the UI's own chrome, in either light or dark theme.
const COLOR_HEX: Record<StickyNoteColor, string> = {
  yellow: "#fdf0a8",
  pink: "#f9d0e0",
  blue: "#c9e4fb",
  green: "#d3f0c9",
  purple: "#e3d6f7",
};

function StickyNoteCard({
  note,
  onChange,
  onColorChange,
  onDelete,
}: {
  note: StickyNote;
  onChange: (id: string, content: string) => void;
  onColorChange: (id: string, color: StickyNoteColor) => void;
  onDelete: (id: string) => void;
}) {
  const [content, setContent] = useState(note.content);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(value: string) {
    setContent(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(note.id, value), 600);
  }

  return (
    <div
      style={{ background: COLOR_HEX[note.color] }}
      className="flex flex-col gap-1.5 rounded-md p-3 text-black/80 shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {STICKY_NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(note.id, color)}
              style={{ background: COLOR_HEX[color] }}
              className={`h-3.5 w-3.5 rounded-full border ${
                note.color === color ? "border-black/60" : "border-black/15"
              }`}
              aria-label={`Set color ${color}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onDelete(note.id)}
          className="text-black/40 transition-colors hover:text-black/80"
          aria-label="Delete note"
        >
          ✕
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="Type a note…"
        rows={4}
        className="w-full resize-none bg-transparent text-sm text-black/80 outline-none placeholder:text-black/40"
      />
    </div>
  );
}

export default function StickyNotesWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isChromelessRoute(pathname)) return;
    let cancelled = false;
    fetch(`/api/sticky-notes?path=${encodeURIComponent(pathname)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return;
        setNotes(data);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (isChromelessRoute(pathname)) return null;

  async function handleAdd() {
    const res = await fetch("/api/sticky-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagePath: pathname, color: "yellow" }),
    });
    if (res.ok) {
      const note = await res.json();
      setNotes((prev) => [...prev, note]);
      setOpen(true);
    }
  }

  function handleChange(id: string, content: string) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
    void fetch(`/api/sticky-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }

  function handleColorChange(id: string, color: StickyNoteColor) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, color } : n)));
    void fetch(`/api/sticky-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
  }

  function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    void fetch(`/api/sticky-notes/${id}`, { method: "DELETE" });
  }

  return (
    <div className="fixed bottom-20 right-5 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="flex max-h-[70vh] w-72 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">Notes on this page</p>
            <button type="button" onClick={handleAdd} className="text-xs text-accent hover:underline">
              + New note
            </button>
          </div>
          {loaded && notes.length === 0 && (
            <p className="text-xs text-muted">No notes here yet — they&apos;re private to you.</p>
          )}
          {notes.map((note) => (
            <StickyNoteCard
              key={note.id}
              note={note}
              onChange={handleChange}
              onColorChange={handleColorChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Sticky notes for this page"
        title="Sticky notes for this page"
      >
        <StickyNoteIcon className="h-5 w-5" />
        {notes.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {notes.length}
          </span>
        )}
      </button>
    </div>
  );
}
