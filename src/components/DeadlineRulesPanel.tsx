"use client";

import { useState } from "react";
import { DEADLINE_DIRECTIONS, DEADLINE_OFFSET_UNITS, type DeadlineDirection, type DeadlineOffsetUnit, type DeadlineRule, type Holiday } from "@/lib/types";

export default function DeadlineRulesPanel({
  initialRules,
  initialHolidays,
}: {
  initialRules: DeadlineRule[];
  initialHolidays: Holiday[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [holidays, setHolidays] = useState(initialHolidays);

  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [offsetDays, setOffsetDays] = useState("");
  const [offsetUnit, setOffsetUnit] = useState<DeadlineOffsetUnit>("calendar");
  const [direction, setDirection] = useState<DeadlineDirection>("after");
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);

  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [creatingHoliday, setCreatingHoliday] = useState(false);

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    setCreatingRule(true);
    setRuleError(null);
    try {
      const res = await fetch("/api/settings/deadline-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ruleName,
          description: ruleDescription || null,
          offsetDays: Number(offsetDays),
          offsetUnit,
          direction,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create rule");
      setRules((prev) => [...prev, body].sort((a, b) => a.name.localeCompare(b.name)));
      setRuleName("");
      setRuleDescription("");
      setOffsetDays("");
    } catch (err) {
      setRuleError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreatingRule(false);
    }
  }

  async function handleDeleteRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/settings/deadline-rules/${id}`, { method: "DELETE" });
  }

  async function handleCreateHoliday(e: React.FormEvent) {
    e.preventDefault();
    setCreatingHoliday(true);
    setHolidayError(null);
    try {
      const res = await fetch("/api/settings/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: holidayName, date: holidayDate, recurringYearly: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create holiday");
      setHolidays((prev) => [...prev, body].sort((a, b) => a.date.localeCompare(b.date)));
      setHolidayName("");
      setHolidayDate("");
    } catch (err) {
      setHolidayError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreatingHoliday(false);
    }
  }

  async function handleDeleteHoliday(id: string) {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    await fetch(`/api/settings/holidays/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mb-2 font-medium">Rules</h3>
        <form onSubmit={handleCreateRule} className="surface-card flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Rule name (e.g. Statement of Defence)"
              className="surface-input"
            />
            <input
              value={ruleDescription}
              onChange={(e) => setRuleDescription(e.target.value)}
              placeholder="Description (optional)"
              className="surface-input"
            />
            <input
              type="number"
              min="0"
              required
              value={offsetDays}
              onChange={(e) => setOffsetDays(e.target.value)}
              placeholder="Number of days"
              className="surface-input"
            />
            <select value={offsetUnit} onChange={(e) => setOffsetUnit(e.target.value as DeadlineOffsetUnit)} className="surface-input">
              {DEADLINE_OFFSET_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u === "calendar" ? "Calendar days" : "Business days"}
                </option>
              ))}
            </select>
            <select value={direction} onChange={(e) => setDirection(e.target.value as DeadlineDirection)} className="surface-input">
              {DEADLINE_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === "after" ? "After the trigger date" : "Before the trigger date"}
                </option>
              ))}
            </select>
          </div>
          {ruleError && <p className="text-sm text-red-600">{ruleError}</p>}
          <button type="submit" disabled={creatingRule} className="btn-primary self-start">
            {creatingRule ? "…" : "Add rule"}
          </button>
        </form>
        {rules.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No deadline rules yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {rules.map((rule) => (
              <li key={rule.id} className="surface-row flex items-center justify-between text-sm">
                <span>
                  <span className="font-medium">{rule.name}</span> — {rule.offsetDays} {rule.offsetUnit} days{" "}
                  {rule.direction} trigger
                  {rule.description && <span className="ml-2 text-muted">{rule.description}</span>}
                </span>
                <button onClick={() => handleDeleteRule(rule.id)} className="text-xs text-muted hover:text-red-600">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium">Holidays</h3>
        <p className="mb-2 text-sm text-muted">
          Used for business-day counting — a business-day rule skips weekends and any date listed
          here.
        </p>
        <form onSubmit={handleCreateHoliday} className="surface-card flex flex-wrap items-end gap-2">
          <input
            required
            value={holidayName}
            onChange={(e) => setHolidayName(e.target.value)}
            placeholder="Holiday name"
            className="surface-input flex-1"
          />
          <input
            type="date"
            required
            value={holidayDate}
            onChange={(e) => setHolidayDate(e.target.value)}
            className="surface-input"
          />
          <button type="submit" disabled={creatingHoliday} className="btn-primary">
            {creatingHoliday ? "…" : "Add holiday"}
          </button>
        </form>
        {holidayError && <p className="mt-2 text-sm text-red-600">{holidayError}</p>}
        {holidays.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No holidays configured yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {holidays.map((holiday) => (
              <li key={holiday.id} className="surface-row flex items-center justify-between text-sm">
                <span>
                  {holiday.name} — {holiday.date}
                  {Boolean(holiday.recurringYearly) && <span className="badge ml-2">recurs yearly</span>}
                </span>
                <button onClick={() => handleDeleteHoliday(holiday.id)} className="text-xs text-muted hover:text-red-600">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
