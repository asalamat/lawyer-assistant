"use client";

import { useState } from "react";
import type { TrustAccount, TrustReconciliation } from "@/lib/types";

type AccountWithBalance = TrustAccount & { balance: number };

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function ReconcilePanel({ account }: { account: AccountWithBalance }) {
  const [statementDate, setStatementDate] = useState("");
  const [bankBalance, setBankBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<TrustReconciliation[] | null>(null);

  async function loadHistory() {
    const res = await fetch(`/api/trust-accounts/${account.id}/reconcile`);
    if (res.ok) setHistory(await res.json());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trust-accounts/${account.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankBalance: Number(bankBalance), statementDate }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to reconcile");
      setHistory((prev) => [body, ...(prev ?? [])]);
      setStatementDate("");
      setBankBalance("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Statement date</label>
          <input
            type="date"
            required
            value={statementDate}
            onChange={(e) => setStatementDate(e.target.value)}
            className="surface-input"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">Bank statement balance</label>
          <input
            type="number"
            step="0.01"
            required
            value={bankBalance}
            onChange={(e) => setBankBalance(e.target.value)}
            className="surface-input w-32"
          />
        </div>
        <button type="submit" disabled={submitting} className="btn-secondary">
          {submitting ? "…" : "Reconcile"}
        </button>
        <button type="button" onClick={loadHistory} className="text-xs text-accent hover:underline">
          {history ? "Refresh history" : "View history"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {history && (
        <ul className="flex flex-col gap-2 text-xs text-muted">
          {history.length === 0 && <li>No reconciliations recorded yet.</li>}
          {history.map((r) => (
            <li key={r.id}>
              <div className={r.variance !== 0 ? "text-amber-700 dark:text-amber-400" : ""}>
                {r.statementDate}: bank {formatMoney(r.bankBalance)}, ledger {formatMoney(r.ledgerBalance)}, variance{" "}
                {formatMoney(r.variance)}
              </div>
              {r.matterBalances.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-accent hover:underline">
                    Client trust ledger ({r.matterBalances.length}) — third leg of the three-way check
                  </summary>
                  <ul className="mt-1 flex flex-col gap-0.5 pl-3">
                    {r.matterBalances.map((mb) => (
                      <li key={mb.matterId} className="flex justify-between gap-4">
                        <span>
                          {mb.clientName} — {mb.matterTitle}
                        </span>
                        <span className="font-display">{formatMoney(mb.balance)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TrustAccountsPanel({
  initialAccounts,
  canManage,
}: {
  initialAccounts: AccountWithBalance[];
  canManage: boolean;
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/trust-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bankName: bankName || null, accountLast4: accountLast4 || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create trust account");
      setAccounts((prev) => [...prev, { ...body, balance: 0 }]);
      setName("");
      setBankName("");
      setAccountLast4("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {canManage && (
        <form onSubmit={handleCreate} className="surface-card flex flex-wrap items-end gap-2">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Account name (e.g. Firm Trust Account)"
            className="surface-input flex-1"
          />
          <input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Bank name (optional)"
            className="surface-input"
          />
          <input
            value={accountLast4}
            onChange={(e) => setAccountLast4(e.target.value)}
            placeholder="Last 4 (optional)"
            maxLength={4}
            className="surface-input w-24"
          />
          <button type="submit" disabled={creating} className="btn-primary">
            {creating ? "…" : "Add account"}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {accounts.length === 0 ? (
        <p className="text-sm text-muted">No trust accounts yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {accounts.map((account) => (
            <li key={account.id} className="surface-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{account.name}</p>
                  {account.bankName && (
                    <p className="text-xs text-muted">
                      {account.bankName}
                      {account.accountLast4 ? ` ····${account.accountLast4}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg">{formatMoney(account.balance)}</span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === account.id ? null : account.id)}
                      className="btn-secondary px-3 py-1.5 text-sm"
                    >
                      {expandedId === account.id ? "Close" : "Reconcile"}
                    </button>
                  )}
                </div>
              </div>
              {expandedId === account.id && <ReconcilePanel account={account} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
