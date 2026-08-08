import { randomUUID } from "crypto";
import { recordAuditEvent } from "./auditLog";
import db, { toPlain } from "./db";
import type { TrustAccount, TrustReconciliation, TrustTransaction, TrustTransactionType } from "./types";

// Bookkeeping support, not accounting/tax advice — the firm is responsible
// for verifying this against its own bar's trust-accounting rules. Balances
// are never stored denormalized; every balance shown anywhere is a fresh
// SUM over trust_transactions, so there is no code path where a displayed
// number can drift from the ledger that produced it.

export async function listTrustAccounts(): Promise<TrustAccount[]> {
  return db
    .prepare("SELECT * FROM trust_accounts ORDER BY name ASC")
    .all()
    .map((row) => toPlain<TrustAccount>(row));
}

export async function getTrustAccount(id: string): Promise<TrustAccount | null> {
  const row = db.prepare("SELECT * FROM trust_accounts WHERE id = ?").get(id);
  return row ? toPlain<TrustAccount>(row) : null;
}

export async function createTrustAccount(input: {
  name: string;
  bankName?: string | null;
  accountLast4?: string | null;
}): Promise<TrustAccount> {
  const name = input.name.trim();
  if (!name) throw new Error("Account name is required");

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO trust_accounts (id, name, bankName, accountLast4, createdAt) VALUES (?, ?, ?, ?, ?)",
  ).run(id, name, input.bankName ?? null, input.accountLast4 ?? null, createdAt);
  return { id, name, bankName: input.bankName ?? null, accountLast4: input.accountLast4 ?? null, createdAt };
}

// A matter's balance is the sum of everything ever recorded against it —
// deposits add, withdrawals and transfers-to-operating subtract. This is
// the number that must never go negative (see recordTrustTransaction).
export async function getMatterTrustBalance(matterId: string): Promise<number> {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) as balance
       FROM trust_transactions WHERE matterId = ?`,
    )
    .get(matterId) as { balance: number };
  return row.balance;
}

// The account-level total is the same SUM without the matterId filter — by
// construction it always equals the sum of every matter's own balance under
// this account, since every transaction is matter-scoped. That equality is
// exactly what makes this a valid ledger, not an assumption to re-check.
export async function getTrustAccountBalance(trustAccountId: string): Promise<number> {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) as balance
       FROM trust_transactions WHERE trustAccountId = ?`,
    )
    .get(trustAccountId) as { balance: number };
  return row.balance;
}

export async function listMatterTrustTransactions(matterId: string): Promise<TrustTransaction[]> {
  return db
    .prepare("SELECT * FROM trust_transactions WHERE matterId = ? ORDER BY transactionDate DESC, createdAt DESC")
    .all(matterId)
    .map((row) => toPlain<TrustTransaction>(row));
}

export async function listTrustAccountTransactions(trustAccountId: string): Promise<TrustTransaction[]> {
  return db
    .prepare("SELECT * FROM trust_transactions WHERE trustAccountId = ? ORDER BY transactionDate DESC, createdAt DESC")
    .all(trustAccountId)
    .map((row) => toPlain<TrustTransaction>(row));
}

// The core compliance rule: a withdrawal or transfer can never take a
// matter's trust balance negative. Trust money is the client's, held
// separately per matter — letting one matter's balance go negative would
// mean spending another client's funds to cover it, which is exactly what
// trust accounting rules exist to prevent.
export async function recordTrustTransaction(input: {
  trustAccountId: string;
  matterId: string;
  type: TrustTransactionType;
  amount: number;
  description: string;
  transactionDate: string;
  userId: string | null;
}): Promise<TrustTransaction> {
  const { trustAccountId, matterId, type, description, transactionDate, userId } = input;
  const amount = input.amount;
  if (!(amount > 0)) throw new Error("Amount must be greater than zero");
  if (!description.trim()) throw new Error("A description is required for every trust transaction");

  const account = await getTrustAccount(trustAccountId);
  if (!account) throw new Error("Trust account not found");

  if (type !== "deposit") {
    const balance = await getMatterTrustBalance(matterId);
    if (amount > balance) {
      throw new Error(
        `This would overdraw the matter's trust balance (currently $${balance.toFixed(2)}) — a withdrawal or transfer can never exceed what's actually held for this matter.`,
      );
    }
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO trust_transactions
       (id, trustAccountId, matterId, type, amount, description, transactionDate, createdByUserId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, trustAccountId, matterId, type, amount, description.trim(), transactionDate, userId, createdAt);

  const action =
    type === "deposit"
      ? "trust_deposit_recorded"
      : type === "withdrawal"
        ? "trust_withdrawal_recorded"
        : "trust_transfer_recorded";
  await recordAuditEvent(
    action,
    matterId,
    `${type === "deposit" ? "Deposited" : type === "withdrawal" ? "Withdrew" : "Transferred to operating"} $${amount.toFixed(2)} — "${description.trim()}" (${account.name})`,
  );

  return { id, trustAccountId, matterId, type, amount, description: description.trim(), transactionDate, createdByUserId: userId, createdAt };
}

export async function listTrustReconciliations(trustAccountId: string): Promise<TrustReconciliation[]> {
  return db
    .prepare("SELECT * FROM trust_reconciliations WHERE trustAccountId = ? ORDER BY statementDate DESC")
    .all(trustAccountId)
    .map((row) => toPlain<TrustReconciliation>(row));
}

// Records the comparison permanently, whether or not it actually balances —
// "we checked on this date and it was off by $X" is itself the bar-audit
// evidence, same reasoning as the app's own audit-log reanchor events.
export async function reconcileTrustAccount(
  trustAccountId: string,
  bankBalance: number,
  statementDate: string,
  userId: string | null,
): Promise<TrustReconciliation> {
  const ledgerBalance = await getTrustAccountBalance(trustAccountId);
  const variance = Math.round((bankBalance - ledgerBalance) * 100) / 100;

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO trust_reconciliations
       (id, trustAccountId, statementDate, bankBalance, ledgerBalance, variance, reconciledByUserId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, trustAccountId, statementDate, bankBalance, ledgerBalance, variance, userId, createdAt);

  const account = await getTrustAccount(trustAccountId);
  await recordAuditEvent(
    "trust_account_reconciled",
    null,
    `Reconciled "${account?.name ?? trustAccountId}" against ${statementDate} statement — bank $${bankBalance.toFixed(2)}, ledger $${ledgerBalance.toFixed(2)}, variance $${variance.toFixed(2)}`,
  );

  return { id, trustAccountId, statementDate, bankBalance, ledgerBalance, variance, reconciledByUserId: userId, createdAt };
}
