"use client";

import { useEffect, useState } from "react";
import { formatDateOnly } from "@/lib/formatDate";
import type { MatterTask } from "@/lib/types";

interface StaffOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function TasksPanel({
  matterId,
  initialTasks,
}: {
  matterId: string;
  initialTasks: MatterTask[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/staff")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStaff(data);
      });
  }, []);

  const staffById = new Map(staff.map((s) => [s.id, s]));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          dueDate: dueDate || undefined,
          assignedToUserId: assignedToUserId || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to add task");
      setTasks((prev) => [...prev, body]);
      setTitle("");
      setDueDate("");
      setAssignedToUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(task: MatterTask) {
    const completed = !task.completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: completed ? 1 : 0 } : t)));
    const res = await fetch(`/api/matters/${matterId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    }
  }

  async function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/matters/${matterId}/tasks/${id}`, { method: "DELETE" });
  }

  const incomplete = tasks.filter((t) => !t.completed);
  const complete = tasks.filter((t) => t.completed);

  return (
    <div className="flex flex-col gap-4">
      <div className="surface-card flex flex-col gap-3">
        <h2 className="font-display text-lg">Tasks</h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Draft motion, call client"
            className="surface-input min-w-[14rem] flex-1"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="surface-input"
          />
          <select
            value={assignedToUserId}
            onChange={(e) => setAssignedToUserId(e.target.value)}
            className="surface-input"
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={adding || !title.trim()} className="btn-primary px-3 py-2">
            {adding ? "Adding…" : "Add task"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="surface-card flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted">No tasks yet.</p>
        ) : (
          <>
            {incomplete.map((task) => (
              <div key={task.id} className="surface-row flex items-center justify-between gap-3 text-sm">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(task.completed)}
                    onChange={() => handleToggle(task)}
                  />
                  <span className="min-w-0 flex-1">{task.title}</span>
                </label>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  {task.dueDate && <span>{formatDateOnly(task.dueDate)}</span>}
                  {task.assignedToUserId && staffById.get(task.assignedToUserId) && (
                    <span className="badge">{staffById.get(task.assignedToUserId)!.name}</span>
                  )}
                  <button onClick={() => handleDelete(task.id)} className="text-muted hover:text-red-600">
                    ✕
                  </button>
                </span>
              </div>
            ))}
            {complete.length > 0 && (
              <>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted">
                  Completed ({complete.length})
                </p>
                {complete.map((task) => (
                  <div key={task.id} className="surface-row flex items-center justify-between gap-3 text-sm">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(task.completed)}
                        onChange={() => handleToggle(task)}
                      />
                      <span className="min-w-0 flex-1 text-muted line-through">{task.title}</span>
                    </label>
                    <button onClick={() => handleDelete(task.id)} className="shrink-0 text-xs text-muted hover:text-red-600">
                      ✕
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
