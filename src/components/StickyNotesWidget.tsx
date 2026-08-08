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

const NOTE_WIDTH = 220;

// Notes are viewport-fixed, not page-scrolled — dragging repositions a note
// on screen, and that position is remembered per page, but the note stays
// put as you scroll rather than tracking a spot in the document.
function StickyNoteCard({
  note,
  isTop,
  onChange,
  onColorChange,
  onDelete,
  onMoveEnd,
  onBringToFront,
}: {
  note: StickyNote;
  isTop: boolean;
  onChange: (id: string, content: string) => void;
  onColorChange: (id: string, color: StickyNoteColor) => void;
  onDelete: (id: string) => void;
  onMoveEnd: (id: string, x: number, y: number) => void;
  onBringToFront: (id: string) => void;
}) {
  const [content, setContent] = useState(note.content);
  const [pos, setPos] = useState({ x: note.x ?? 0, y: note.y ?? 0 });
  // Tracks the live position during a drag directly on the ref — reading
  // it back in handlePointerUp must not depend on React having already
  // re-rendered and flushed an effect for the latest setPos call, since a
  // pointerup can fire before that happens (React batches state updates,
  // and there's no guaranteed flush between a move and the up event right
  // after it).
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; lastX: number; lastY: number } | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(value: string) {
    setContent(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(note.id, value), 600);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    onBringToFront(note.id);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, lastX: pos.x, lastY: pos.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const next = {
      x: Math.max(0, Math.min(window.innerWidth - NOTE_WIDTH, dragRef.current.origX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 40, dragRef.current.origY + dy)),
    };
    dragRef.current.lastX = next.x;
    dragRef.current.lastY = next.y;
    setPos(next);
  }

  function handlePointerUp() {
    if (!dragRef.current) return;
    const { lastX, lastY } = dragRef.current;
    dragRef.current = null;
    onMoveEnd(note.id, lastX, lastY);
  }

  return (
    <div
      style={{ position: "fixed", left: pos.x, top: pos.y, width: NOTE_WIDTH, zIndex: isTop ? 50 : 40 }}
      className="pointer-events-auto"
    >
      <div
        style={{ background: COLOR_HEX[note.color] }}
        className="flex flex-col gap-1.5 rounded-md p-3 text-black/80 shadow-md"
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex items-center justify-between"
          style={{ cursor: "grab", touchAction: "none" }}
        >
          <div className="flex gap-1">
            {STICKY_NOTE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
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
            onPointerDown={(e) => e.stopPropagation()}
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
    </div>
  );
}

// Cascades new notes near the bottom-right add button rather than stacking
// them exactly on top of each other.
function defaultPosition(existingCount: number): { x: number; y: number } {
  const offset = (existingCount % 6) * 24;
  return {
    x: Math.max(16, window.innerWidth - NOTE_WIDTH - 24 - offset),
    y: Math.max(16, window.innerHeight - 320 - offset),
  };
}

export default function StickyNotesWidget() {
  const pathname = usePathname();
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [topId, setTopId] = useState<string | null>(null);

  useEffect(() => {
    if (isChromelessRoute(pathname)) return;
    let cancelled = false;
    fetch(`/api/sticky-notes?path=${encodeURIComponent(pathname)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: StickyNote[]) => {
        if (cancelled) return;
        // A note with no position yet (created before it was ever dragged,
        // or from before position tracking existed) gets a default now,
        // persisted so it doesn't jump around on the next load.
        const placed = data.map((note, i) => {
          if (note.x !== null && note.y !== null) return note;
          const position = defaultPosition(i);
          void fetch(`/api/sticky-notes/${note.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(position),
          });
          return { ...note, ...position };
        });
        setNotes(placed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (isChromelessRoute(pathname)) return null;

  async function handleAdd() {
    const position = defaultPosition(notes.length);
    const res = await fetch("/api/sticky-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagePath: pathname, color: "yellow", ...position }),
    });
    if (res.ok) {
      const note = await res.json();
      setNotes((prev) => [...prev, note]);
      setTopId(note.id);
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

  function handleMoveEnd(id: string, x: number, y: number) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
    void fetch(`/api/sticky-notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y }),
    });
  }

  function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    void fetch(`/api/sticky-notes/${id}`, { method: "DELETE" });
  }

  return (
    <>
      {notes.map((note) => (
        <StickyNoteCard
          key={note.id}
          note={note}
          isTop={note.id === topId}
          onChange={handleChange}
          onColorChange={handleColorChange}
          onDelete={handleDelete}
          onMoveEnd={handleMoveEnd}
          onBringToFront={setTopId}
        />
      ))}
      <button
        type="button"
        onClick={handleAdd}
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105"
        aria-label="Add a sticky note to this page"
        title="Add a sticky note to this page"
      >
        <StickyNoteIcon className="h-5 w-5" />
        {notes.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {notes.length}
          </span>
        )}
      </button>
    </>
  );
}
