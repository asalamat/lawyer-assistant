"use client";

import { useState } from "react";
import { formatDateOnly } from "@/lib/formatDate";
import type { SignableDocument, SignableDocumentStatus } from "@/lib/signableDocuments";
import type { Disbursement, Invoice, TimeEntry } from "@/lib/types";

const APPROVAL_STATUS_LABELS: Record<SignableDocumentStatus, string> = {
  draft: "Approval prepared",
  sent: "Awaiting client approval",
  signed: "Approved by client",
  declined: "Client declined",
  voided: "Approval voided",
  expired: "Approval link expired",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function invoiceEmailBody(invoice: Invoice, entries: TimeEntry[], disbursements: Disbursement[]): string {
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
  if (disbursements.length > 0) {
    lines.push(
      "",
      "Disbursements:",
      ...disbursements.map(
        (d) => `${formatDateOnly(d.incurredOn)} — ${d.category}: ${d.description} — ${formatCurrency(d.amount)}`,
      ),
      `Disbursements total: ${formatCurrency(invoice.disbursementsTotal)}`,
    );
  }
  if (invoice.discount > 0) lines.push(`Discount: -${formatCurrency(invoice.discount)}`);
  lines.push(`Total due: ${formatCurrency(invoice.total)}`);
  return lines.join("\n");
}

export default function TimesheetPanel({
  matterId,
  initialEntries,
  initialDisbursements,
  initialInvoices,
  clientEmail,
  emailConfigured,
  initialHourlyRate,
  initialSignableDocuments,
}: {
  matterId: string;
  initialEntries: TimeEntry[];
  initialDisbursements: Disbursement[];
  initialInvoices: Invoice[];
  clientEmail: string | null;
  emailConfigured: boolean;
  initialHourlyRate: number | null;
  initialSignableDocuments: SignableDocument[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [disbursements, setDisbursements] = useState(initialDisbursements);
  const [invoices, setInvoices] = useState(initialInvoices);
  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, SignableDocumentStatus>>(() =>
    Object.fromEntries(initialSignableDocuments.map((d) => [d.id, d.status])),
  );
  const [approvalRequestingId, setApprovalRequestingId] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<{ id: string; message: string } | null>(null);
  const [approvalLinks, setApprovalLinks] = useState<Record<string, string>>({});
  const [approvalEmailedTo, setApprovalEmailedTo] = useState<Record<string, string>>({});
  const [approvalViaDocuSign, setApprovalViaDocuSign] = useState<Record<string, boolean>>({});
  const [copiedApprovalId, setCopiedApprovalId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ id: string; ok: boolean; message: string } | null>(
    null,
  );
  const [workedOn, setWorkedOn] = useState(today());
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [incurredOn, setIncurredOn] = useState(today());
  const [category, setCategory] = useState("");
  const [disbursementDescription, setDisbursementDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submittingDisbursement, setSubmittingDisbursement] = useState(false);
  const [disbursementError, setDisbursementError] = useState<string | null>(null);
  const [disbursementDeleteError, setDisbursementDeleteError] = useState<string | null>(null);

  const [matterRate, setMatterRate] = useState(initialHourlyRate);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(initialHourlyRate ?? ""));
  const [savingRate, setSavingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDisbursementIds, setSelectedDisbursementIds] = useState<Set<string>>(new Set());
  const [hourlyRate, setHourlyRate] = useState(initialHourlyRate != null ? String(initialHourlyRate) : "");
  const [discount, setDiscount] = useState("0");
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const unbilled = entries.filter((e) => !e.invoiceId);
  const unbilledDisbursements = disbursements.filter((d) => !d.invoiceId);
  const selectedEntries = unbilled.filter((e) => selectedIds.has(e.id));
  const selectedHours = selectedEntries.reduce((sum, e) => sum + e.hours, 0);
  const selectedDisbursements = unbilledDisbursements.filter((d) => selectedDisbursementIds.has(d.id));
  const selectedDisbursementsTotal = selectedDisbursements.reduce((sum, d) => sum + d.amount, 0);
  const previewSubtotal = selectedHours * (Number(hourlyRate) || 0);
  const previewTotal = Math.max(0, previewSubtotal + selectedDisbursementsTotal - (Number(discount) || 0));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === unbilled.length ? new Set() : new Set(unbilled.map((e) => e.id))));
  }

  function toggleSelectedDisbursement(id: string) {
    setSelectedDisbursementIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllDisbursements() {
    setSelectedDisbursementIds((prev) =>
      prev.size === unbilledDisbursements.length ? new Set() : new Set(unbilledDisbursements.map((d) => d.id)),
    );
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

  async function handleAddDisbursement(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingDisbursement(true);
    setDisbursementError(null);
    try {
      const formData = new FormData();
      formData.append("incurredOn", incurredOn);
      formData.append("category", category);
      formData.append("description", disbursementDescription);
      formData.append("amount", amount);
      if (receiptFile) formData.append("receipt", receiptFile);
      const res = await fetch(`/api/matters/${matterId}/disbursements`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to log disbursement");
      setDisbursements((prev) =>
        [body, ...prev].sort(
          (a, b) => b.incurredOn.localeCompare(a.incurredOn) || b.createdAt.localeCompare(a.createdAt),
        ),
      );
      setCategory("");
      setDisbursementDescription("");
      setAmount("");
      setReceiptFile(null);
    } catch (err) {
      setDisbursementError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmittingDisbursement(false);
    }
  }

  async function handleDeleteDisbursement(disbursementId: string) {
    setDisbursementDeleteError(null);
    const res = await fetch(`/api/matters/${matterId}/disbursements/${disbursementId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDisbursementDeleteError(body.error ?? "Failed to delete disbursement");
      return;
    }
    setDisbursements((prev) => prev.filter((d) => d.id !== disbursementId));
    setSelectedDisbursementIds((prev) => {
      const next = new Set(prev);
      next.delete(disbursementId);
      return next;
    });
  }

  async function handleSaveRate() {
    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRateError("Enter a positive hourly rate.");
      return;
    }
    setSavingRate(true);
    setRateError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyRate: parsed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save rate");
      setMatterRate(parsed);
      setHourlyRate(String(parsed));
      setEditingRate(false);
    } catch (err) {
      setRateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingRate(false);
    }
  }

  async function handleCreateInvoice() {
    if (selectedEntries.length === 0) {
      setInvoiceError("Select at least one time entry first.");
      return;
    }
    if (!hourlyRate || Number(hourlyRate) <= 0) {
      setInvoiceError("Set this matter's hourly rate to create an invoice.");
      return;
    }
    setInvoicing(true);
    setInvoiceError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryIds: [...selectedIds],
          disbursementIds: [...selectedDisbursementIds],
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
      setDisbursements((prev) =>
        prev.map((d) => (selectedDisbursementIds.has(d.id) ? { ...d, invoiceId: body.id } : d)),
      );
      setSelectedIds(new Set());
      setSelectedDisbursementIds(new Set());
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

  function sendViaMailto(invoice: Invoice) {
    const invoiceEntries = entries.filter((e) => e.invoiceId === invoice.id);
    const invoiceDisbursements = disbursements.filter((d) => d.invoiceId === invoice.id);
    const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber}`);
    const body = encodeURIComponent(invoiceEmailBody(invoice, invoiceEntries, invoiceDisbursements));
    const to = clientEmail ? encodeURIComponent(clientEmail) : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  async function handleSend(invoice: Invoice) {
    // Without SMTP configured, fall back to opening the user's own mail client.
    if (!emailConfigured) {
      sendViaMailto(invoice);
      return;
    }

    let to = clientEmail ?? "";
    if (!to) {
      const entered = window.prompt("Send invoice to which email address?");
      if (!entered) return;
      to = entered;
    }

    setSendingId(invoice.id);
    setSendResult(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to send invoice");
      setSendResult({ id: invoice.id, ok: true, message: `Sent to ${body.to}.` });
    } catch (err) {
      setSendResult({
        id: invoice.id,
        ok: false,
        message: err instanceof Error ? err.message : "Failed to send invoice",
      });
    } finally {
      setSendingId(null);
    }
  }

  async function handleRequestApproval(invoice: Invoice) {
    setApprovalRequestingId(invoice.id);
    setApprovalError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/invoices/${invoice.id}/request-approval`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to request approval");
      setInvoices((prev) => prev.map((inv) => (inv.id === invoice.id ? body.invoice : inv)));
      setApprovalStatuses((prev) => ({ ...prev, [body.invoice.signableDocumentId]: "sent" }));
      setApprovalLinks((prev) => {
        const next = { ...prev };
        if (body.signUrl) next[invoice.id] = body.signUrl;
        else delete next[invoice.id];
        return next;
      });
      setApprovalViaDocuSign((prev) => ({ ...prev, [invoice.id]: Boolean(body.docusignEnvelopeId) }));
      setApprovalEmailedTo((prev) => {
        const next = { ...prev };
        if (body.emailedTo) next[invoice.id] = body.emailedTo;
        else delete next[invoice.id];
        return next;
      });
    } catch (err) {
      setApprovalError({
        id: invoice.id,
        message: err instanceof Error ? err.message : "Failed to request approval",
      });
    } finally {
      setApprovalRequestingId(null);
    }
  }

  // Matches ConsentPanel.tsx's copy-link pattern — no email is ever sent
  // automatically for a signing link anywhere in this app; the lawyer
  // copies it and delivers it themselves (email, text, in person).
  async function copyApprovalLink(invoiceId: string, signUrl: string) {
    await navigator.clipboard.writeText(`${window.location.origin}${signUrl}`);
    setCopiedApprovalId(invoiceId);
    setTimeout(() => setCopiedApprovalId((current) => (current === invoiceId ? null : current)), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="surface-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Timesheet</h2>
          <span className="badge-accent">{totalHours.toFixed(1)} hrs total</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Billing rate for this matter:</span>
          {editingRate ? (
            <>
              <input
                type="number"
                step="0.01"
                min="0.01"
                autoFocus
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="surface-input w-28"
              />
              <button onClick={handleSaveRate} disabled={savingRate} className="btn-secondary px-2 py-1 text-xs">
                {savingRate ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingRate(false);
                  setRateInput(String(matterRate ?? ""));
                  setRateError(null);
                }}
                className="text-xs text-muted hover:underline"
              >
                Cancel
              </button>
            </>
          ) : matterRate != null ? (
            <>
              <span className="font-medium text-accent">{formatCurrency(matterRate)}/hr</span>
              <button onClick={() => setEditingRate(true)} className="text-xs text-accent hover:underline">
                Edit
              </button>
            </>
          ) : (
            <button onClick={() => setEditingRate(true)} className="text-xs text-accent hover:underline">
              Set a rate
            </button>
          )}
        </div>
        {rateError && <p className="text-sm text-red-600">{rateError}</p>}

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
                <div>
                  <p>{entry.description}</p>
                  <p className="text-xs text-muted">{formatDateOnly(entry.workedOn)}</p>
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
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Disbursements</h2>
          <span className="badge-accent">
            {formatCurrency(disbursements.reduce((sum, d) => sum + d.amount, 0))} total
          </span>
        </div>
        <p className="text-sm text-muted">
          Hard costs billed to this matter — filing fees, expert witnesses, courier, etc. — kept
          separate from time entries.
        </p>

        <form onSubmit={handleAddDisbursement} className="grid gap-2 sm:grid-cols-2">
          <input
            required
            type="date"
            value={incurredOn}
            onChange={(e) => setIncurredOn(e.target.value)}
            className="surface-input"
          />
          <input
            required
            placeholder="Category (e.g. Filing fee)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="surface-input"
          />
          <input
            required
            placeholder="Description"
            value={disbursementDescription}
            onChange={(e) => setDisbursementDescription(e.target.value)}
            className="surface-input sm:col-span-2"
          />
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            placeholder="Amount ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="surface-input"
          />
          <label className="surface-input flex items-center gap-2 text-sm text-muted">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
          </label>
          <button type="submit" disabled={submittingDisbursement} className="btn-primary sm:col-span-2">
            {submittingDisbursement ? "Logging…" : "Log disbursement"}
          </button>
        </form>
        {disbursementError && <p className="text-sm text-red-600">{disbursementError}</p>}
        {disbursementDeleteError && <p className="text-sm text-red-600">{disbursementDeleteError}</p>}

        {disbursements.length === 0 ? (
          <p className="text-sm text-muted">No disbursements logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {disbursements.map((d) => (
              <li key={d.id} className="surface-row flex items-center justify-between text-sm">
                <div>
                  <p>
                    {d.category}: {d.description}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateOnly(d.incurredOn)}
                    {d.receiptDocumentId && " · receipt attached"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-accent">{formatCurrency(d.amount)}</span>
                  {d.invoiceId ? (
                    <span className="badge">
                      {invoices.find((inv) => inv.id === d.invoiceId)?.invoiceNumber ?? "Invoiced"}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDeleteDisbursement(d.id)}
                      className="text-xs text-muted hover:text-red-600"
                      aria-label="Delete disbursement"
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
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.size === unbilled.length}
                  onChange={toggleSelectAll}
                />
                Select all unbilled ({unbilled.length})
              </label>
              <span className="text-sm text-muted">
                {selectedEntries.length} selected &middot; {selectedHours.toFixed(1)}h
              </span>
            </div>
            <ul className="flex flex-col gap-1">
              {unbilled.map((entry) => (
                <li key={entry.id} className="surface-row flex items-center justify-between text-sm">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleSelected(entry.id)}
                    />
                    <div>
                      <p>{entry.description}</p>
                      <p className="text-xs text-muted">{formatDateOnly(entry.workedOn)}</p>
                    </div>
                  </label>
                  <span className="font-medium text-accent">{entry.hours.toFixed(1)}h</span>
                </li>
              ))}
            </ul>

            {unbilledDisbursements.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedDisbursementIds.size === unbilledDisbursements.length}
                      onChange={toggleSelectAllDisbursements}
                    />
                    Include unbilled disbursements ({unbilledDisbursements.length})
                  </label>
                  <span className="text-sm text-muted">
                    {selectedDisbursements.length} selected &middot; {formatCurrency(selectedDisbursementsTotal)}
                  </span>
                </div>
                <ul className="flex flex-col gap-1">
                  {unbilledDisbursements.map((d) => (
                    <li key={d.id} className="surface-row flex items-center justify-between text-sm">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedDisbursementIds.has(d.id)}
                          onChange={() => toggleSelectedDisbursement(d.id)}
                        />
                        <div>
                          <p>
                            {d.category}: {d.description}
                          </p>
                          <p className="text-xs text-muted">{formatDateOnly(d.incurredOn)}</p>
                        </div>
                      </label>
                      <span className="font-medium text-accent">{formatCurrency(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
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
              <button onClick={handleCreateInvoice} disabled={invoicing} className="btn-primary">
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
              <li key={invoice.id} className="surface-row flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-muted">
                      {formatDateOnly(invoice.createdAt.slice(0, 10))} &middot; {invoice.hours.toFixed(1)}h @{" "}
                      {formatCurrency(invoice.hourlyRate)}/hr
                      {invoice.disbursementsTotal > 0 &&
                        ` · ${formatCurrency(invoice.disbursementsTotal)} disbursements`}
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
                    <button
                      onClick={() => handleSend(invoice)}
                      disabled={sendingId === invoice.id}
                      className="btn-secondary px-2 py-1 text-xs"
                    >
                      {sendingId === invoice.id ? "Sending…" : emailConfigured ? "Email" : "Send"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {invoice.signableDocumentId && approvalStatuses[invoice.signableDocumentId] && (
                    <span
                      className={
                        approvalStatuses[invoice.signableDocumentId] === "signed" ? "badge-accent" : "badge"
                      }
                    >
                      {APPROVAL_STATUS_LABELS[approvalStatuses[invoice.signableDocumentId]]}
                    </span>
                  )}
                  {approvalStatuses[invoice.signableDocumentId ?? ""] !== "signed" && (
                    <button
                      onClick={() => handleRequestApproval(invoice)}
                      disabled={approvalRequestingId === invoice.id}
                      className="text-xs text-accent hover:underline"
                    >
                      {approvalRequestingId === invoice.id
                        ? "Requesting…"
                        : invoice.signableDocumentId
                          ? "Resend approval link"
                          : "Request client approval"}
                    </button>
                  )}
                </div>
                {approvalError?.id === invoice.id && (
                  <p className="text-xs text-red-600">{approvalError.message}</p>
                )}
                {approvalViaDocuSign[invoice.id] && (
                  <p className="text-xs text-muted">
                    Sent via DocuSign{approvalEmailedTo[invoice.id] ? ` to ${approvalEmailedTo[invoice.id]}` : ""}{" "}
                    — the client approves on DocuSign&apos;s own site, nothing further to send.
                  </p>
                )}
                {approvalLinks[invoice.id] && (
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-black/[0.03] px-3 py-2 dark:bg-white/[0.05]">
                      <code className="min-w-0 flex-1 truncate font-mono text-xs">{approvalLinks[invoice.id]}</code>
                      <button
                        onClick={() => copyApprovalLink(invoice.id, approvalLinks[invoice.id])}
                        className="text-xs text-accent hover:underline"
                      >
                        {copiedApprovalId === invoice.id ? "Copied" : "Copy link"}
                      </button>
                    </div>
                    <p className="text-xs text-muted">
                      {approvalEmailedTo[invoice.id]
                        ? `Emailed to ${approvalEmailedTo[invoice.id]}.`
                        : "No client email on file (or email isn't configured) — copy the link above and send it yourself."}
                    </p>
                  </div>
                )}
                {sendResult?.id === invoice.id && (
                  <p className={`text-xs ${sendResult.ok ? "text-green-600" : "text-red-600"}`}>
                    {sendResult.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
