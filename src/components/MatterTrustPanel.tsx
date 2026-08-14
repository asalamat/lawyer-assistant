"use client";

import Link from "next/link";
import { useState } from "react";
import { TRUST_TRANSACTION_TYPES, type TrustAccount, type TrustTransaction, type TrustTransactionType } from "@/lib/types";

const TYPE_LABELS: Record<TrustTransactionType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer_to_operating: "Transfer to operating",
};

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function MatterTrustPanel({
  matterId,
  initialBalance,
  initialTransactions,
  accounts,
  initialRetainerThreshold,
}: {
  matterId: string;
  initialBalance: number;
  initialTransactions: TrustTransaction[];
  accounts: TrustAccount[];
  initialRetainerThreshold: number | null;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [retainerThreshold, setRetainerThreshold] = useState(initialRetainerThreshold);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(
    initialRetainerThreshold != null ? String(initialRetainerThreshold) : "",
  );
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [trustAccountId, setTrustAccountId] = useState(accounts[0]?.id ?? "");
  const [type, setType] = useState<TrustTransactionType>("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/trust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trustAccountId, type, amount: Number(amount), description, transactionDate }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to record transaction");
      setTransactions((prev) => [body, ...prev]);
      setBalance((prev) => (type === "deposit" ? prev + Number(amount) : prev - Number(amount)));
      setAmount("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveThreshold() {
    let parsed: number | null = null;
    if (thresholdInput.trim() !== "") {
      parsed = Number(thresholdInput);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setThresholdError("Enter a non-negative number, or leave blank to turn off the alert.");
        return;
      }
    }
    setSavingThreshold(true);
    setThresholdError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retainerThreshold: parsed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to save");
      setRetainerThreshold(parsed);
      setEditingThreshold(false);
    } catch (err) {
      setThresholdError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSavingThreshold(false);
    }
  }

  const isLow = retainerThreshold != null && balance < retainerThreshold;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 font-display text-lg">Trust ledger</h2>
        <p className="text-sm text-muted">
          Bookkeeping support, not accounting/tax advice. Current balance held for this matter:
        </p>
        <p className="font-display text-3xl">{formatMoney(balance)}</p>

        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-muted">Low-balance alert:</span>
          {editingThreshold ? (
            <>
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                placeholder="No alert"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="surface-input w-28"
              />
              <button onClick={handleSaveThreshold} disabled={savingThreshold} className="btn-secondary px-2 py-1 text-xs">
                {savingThreshold ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingThreshold(false);
                  setThresholdInput(retainerThreshold != null ? String(retainerThreshold) : "");
                  setThresholdError(null);
                }}
                className="text-xs text-muted hover:underline"
              >
                Cancel
              </button>
            </>
          ) : retainerThreshold != null ? (
            <>
              <span className="font-medium text-accent">Notify below {formatMoney(retainerThreshold)}</span>
              <button onClick={() => setEditingThreshold(true)} className="text-xs text-accent hover:underline">
                Edit
              </button>
            </>
          ) : (
            <button onClick={() => setEditingThreshold(true)} className="text-xs text-accent hover:underline">
              Set a threshold
            </button>
          )}
        </div>
        {thresholdError && <p className="mt-1 text-xs text-red-600">{thresholdError}</p>}

        {isLow && (
          <p className="surface-row mt-2 border-amber-500/40 bg-amber-500/10 text-sm text-amber-800 dark:text-amber-300">
            This matter&apos;s retainer is below your ${retainerThreshold!.toFixed(2)} threshold — consider
            requesting a top-up before continuing work.
          </p>
        )}
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-muted">
          No trust accounts exist yet.{" "}
          <Link href="/trust-accounting" className="text-accent hover:underline">
            Create one
          </Link>{" "}
          before recording transactions for this matter.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={trustAccountId}
              onChange={(e) => setTrustAccountId(e.target.value)}
              className="surface-input"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TrustTransactionType)}
              className="surface-input"
            >
              {TRUST_TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="surface-input"
            />
            <input
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="surface-input"
            />
          </div>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. Retainer deposit)"
            className="surface-input"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary self-start">
            {submitting ? "Recording…" : "Record transaction"}
          </button>
        </form>
      )}

      <div>
        <h3 className="mb-2 font-display text-lg">History</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted">No trust transactions recorded for this matter yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transactions.map((t) => (
              <li key={t.id} className="surface-row flex items-center justify-between text-sm">
                <span>
                  {t.description}
                  <span className="badge ml-2">{TYPE_LABELS[t.type]}</span>
                </span>
                <span className="flex items-center gap-3 text-muted">
                  {t.transactionDate}
                  <span className={t.type === "deposit" ? "text-green-600 dark:text-green-400" : "text-foreground"}>
                    {t.type === "deposit" ? "+" : "-"}
                    {formatMoney(t.amount)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
