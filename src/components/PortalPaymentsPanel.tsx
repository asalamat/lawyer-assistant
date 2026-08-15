"use client";

import { useState } from "react";
import type { Invoice } from "@/lib/types";

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function PortalPaymentsPanel({
  matterId,
  initialInvoices,
  justPaid,
}: {
  matterId: string;
  initialInvoices: Invoice[];
  justPaid: boolean;
}) {
  const [invoices] = useState(initialInvoices);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  const unpaidInvoices = invoices.filter((inv) => inv.status !== "paid");

  async function handlePayInvoice(invoiceId: string) {
    setPayingId(invoiceId);
    setError(null);
    try {
      const res = await fetch(`/api/portal/matters/${matterId}/invoices/${invoiceId}/pay`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to start payment");
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPayingId(null);
    }
  }

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(depositAmount);
    if (!(amount > 0)) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setDepositing(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/matters/${matterId}/trust-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to start payment");
      window.location.assign(body.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDepositing(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-3">
      <h2 className="font-display text-lg">Payments</h2>
      {justPaid && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Thank you — your payment has been received.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <p className="mb-1 text-sm font-medium">Outstanding invoices</p>
        {unpaidInvoices.length === 0 ? (
          <p className="text-sm text-muted">Nothing outstanding right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {unpaidInvoices.map((invoice) => (
              <li key={invoice.id} className="surface-row flex items-center justify-between text-sm">
                <span>
                  {invoice.invoiceNumber} — {formatCurrency(invoice.total)}
                </span>
                <button
                  onClick={() => handlePayInvoice(invoice.id)}
                  disabled={payingId === invoice.id}
                  className="btn-primary px-3 py-1 text-xs"
                >
                  {payingId === invoice.id ? "Redirecting…" : "Pay now"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleDeposit} className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-sm font-medium">Make a trust deposit</p>
        <p className="text-xs text-muted">
          An advance payment held in trust for this matter, separate from paying an invoice above.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount"
            className="surface-input w-32"
          />
          <button type="submit" disabled={depositing} className="btn-secondary px-3 py-1.5 text-xs">
            {depositing ? "Redirecting…" : "Deposit"}
          </button>
        </div>
      </form>
    </div>
  );
}
