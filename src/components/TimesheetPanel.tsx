"use client";

import { useState } from "react";
import { formatDateOnly } from "@/lib/formatDate";
import type { Invoice, TimeEntry } from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function invoiceEmailBody(invoice: Invoice, entries: TimeEntry[]): string {
  const lines = [
    `Invoice ${invoice.invoiceNumber}`,
    `Date: ${formatDateOnly(invoice.createdAt.slice(0, 10))}`,
    "",
    ...entries.map(
      (e) => `${formatDateOnly(e.workedOn)} — ${e.description} — ${e.hours.toFixed(1)}h`,
    ),
    "",
    `Hours: ${invoice.hours.toFixed(1)} @ ${formatCurrency(invoice.hourlyRate)}/hr`,
    `Subtotal: ${formatCurrency(invoice.subtotal)}`,
  ];
  if (invoice.discount > 0) lines.push(`Discount: -${formatCurrency(invoice.discount)}`);
  lines.push(`Total due: ${formatCurrency(invoice.total)}`);
  return lines.join("\n");
}

export default function TimesheetPanel({
  matterId,
  initialEntries,
  initialInvoices,
}: {
  matterId: string;
  initialEntries: TimeEntry[];
  initialInvoices: Invoice[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [workedOn, setWorkedOn] = useState(today());
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hourlyRate, setHourlyRate] = useState("");
  const [discount, setDiscount] = useState("0");
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const unbilled = entries.filter((e) => !e.invoiceId);
  const selectedEntries = unbilled.filter((e) => selectedIds.has(e.id));
  const selectedHours = selectedEntries.reduce((sum, e) => sum + e.hours, 0);
  const previewSubtotal = selectedHours * (Number(hourlyRate) || 0);
  const previewTotal = Math.max(0, previewSubtotal - (Number(discount) || 0));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/time-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workedOn, description, hours: Number(hours) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to log time");
      setEntries((prev) =>
        [body, ...prev].sort(
          (a, b) => b.workedOn.localeCompare(a.workedOn) || b.createdAt.localeCompare(a.createdAt),
        ),
      );
      setDescription("");
      setHours("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(entryId: string) {
    setDeleteError(null);
    const res = await fetch(`/api/matters/${matterId}/time-entries/${entryId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error ?? "Failed to delete time entry");
      return;
    }
    setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(entryId);
      return next;
    });
  }

  async function handleCreateInvoice() {
    setInvoicing(true);
    setInvoiceError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds: [...selectedIds],
          hourlyRate: Number(hourlyRate),
          discount: Number(discount) || 0,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create invoice");
      setInvoices((prev) => [body, ...prev]);
      setEntries((prev) =>
        prev.map((entry) => (selectedIds.has(entry.id) ? { ...entry, invoiceId: body.id } : entry)),
      );
      setSelectedIds(new Set());
      setHourlyRate("");
      setDiscount("0");
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInvoicing(false);
    }
  }

  async function handleTogglePaid(invoice: Invoice) {
    const nextStatus = invoice.status === "paid" ? "unpaid" : "paid";
    const res = await fetch(`/api/matters/${matterId}/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setInvoices((prev) => prev.map((inv) => (inv.id === invoice.id ? updated : inv)));
  }

  function handleSend(invoice: Invoice) {
    const invoiceEntries = entries.filter((e) => e.invoiceId === invoice.id);
    const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber}`);
    const body = encodeURIComponent(invoiceEmailBody(invoice, invoiceEntries));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="surface-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Timesheet</h2>
          <span className="badge-accent">{totalHours.toFixed(1)} hrs total</span>
        </div>

        <form onSubmit={handleAdd} className="grid gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
          <input
            required
            type="date"
            value={workedOn}
            onChange={(e) => setWorkedOn(e.target.value)}
            className="surface-input"
          />
          <input
            required
            placeholder="What did you work on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="surface-input"
          />
          <input
            required
            type="number"
            step="0.1"
            min="0.1"
            placeholder="Hours"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="surface-input w-24"
          />
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Logging…" : "Log time"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

        {entries.length === 0 ? (
          <p className="text-sm text-muted">No time logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => (
              <li key={entry.id} className="surface-row flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  {!entry.invoiceId && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleSelected(entry.id)}
                      aria-label="Select for invoice"
                    />
                  )}
                  <div>
                    <p>{entry.description}</p>
                    <p className="text-xs text-muted">{formatDateOnly(entry.workedOn)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-accent">{entry.hours.toFixed(1)}h</span>
                  {entry.invoiceId ? (
                    <span className="badge">
                      {invoices.find((inv) => inv.id === entry.invoiceId)?.invoiceNumber ?? "Invoiced"}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs text-muted hover:text-red-600"
                      aria-label="Delete time entry"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="surface-card flex flex-col gap-3">
        <h2 className="font-display text-lg">Create invoice</h2>
        {unbilled.length === 0 ? (
          <p className="text-sm text-muted">No unbilled time entries.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              {selectedEntries.length} of {unbilled.length} unbilled entries selected (
              {selectedHours.toFixed(1)}h)
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Hourly rate ($)"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="surface-input"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Discount ($)"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="surface-input"
              />
              <button
                onClick={handleCreateInvoice}
                disabled={invoicing || selectedEntries.length === 0 || !hourlyRate}
                className="btn-primary"
              >
                {invoicing ? "Creating…" : `Create invoice (${formatCurrency(previewTotal)})`}
              </button>
            </div>
            {invoiceError && <p className="text-sm text-red-600">{invoiceError}</p>}
          </>
        )}
      </div>

      <div className="surface-card flex flex-col gap-3">
        <h2 className="font-display text-lg">Invoice history</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">No invoices sent yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="surface-row flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted">
                    {formatDateOnly(invoice.createdAt.slice(0, 10))} &middot; {invoice.hours.toFixed(1)}h @{" "}
                    {formatCurrency(invoice.hourlyRate)}/hr
                    {invoice.discount > 0 && ` · ${formatCurrency(invoice.discount)} discount`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-accent">{formatCurrency(invoice.total)}</span>
                  <span className={invoice.status === "paid" ? "badge-accent" : "badge"}>
                    {invoice.status}
                  </span>
                  <button onClick={() => handleTogglePaid(invoice)} className="btn-secondary px-2 py-1 text-xs">
                    Mark {invoice.status === "paid" ? "unpaid" : "paid"}
                  </button>
                  <button onClick={() => handleSend(invoice)} className="btn-secondary px-2 py-1 text-xs">
                    Send
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
