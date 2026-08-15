import { recordAuditEvent } from "./auditLog";
import { createCheckoutSession, getCheckoutSession } from "./stripe";
import db, { toPlain } from "./db";
import { getInvoice, getMatter, updateInvoiceStatus } from "./matters";
import { listTrustAccounts, recordTrustTransaction } from "./trustAccounting";

interface StripeSessionRow {
  id: string;
  matterId: string;
  purpose: "invoice" | "trust_deposit";
  invoiceId: string | null;
  trustAccountId: string | null;
  amount: number;
  status: "pending" | "completed";
  createdAt: string;
  completedAt: string | null;
}

function getSessionRow(sessionId: string): StripeSessionRow | null {
  const row = db.prepare("SELECT * FROM stripe_payment_sessions WHERE id = ?").get(sessionId);
  return row ? toPlain<StripeSessionRow>(row) : null;
}

// Client-initiated (see /api/portal/matters/[id]/invoices/[invoiceId]/pay)
// — this pays an already-issued invoice, i.e. already-earned fees, which
// belong in the firm's operating funds, never trust. Kept entirely
// separate from createTrustDepositSession below so an online payment can
// never accidentally cross that line.
export async function createInvoicePaymentSession(
  matterId: string,
  invoiceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  const invoice = await getInvoice(matterId, invoiceId);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "paid") throw new Error("This invoice is already paid");
  const matter = await getMatter(matterId);
  if (!matter) throw new Error("Matter not found");

  const session = await createCheckoutSession({
    amount: invoice.total,
    description: `Invoice ${invoice.invoiceNumber} — ${matter.title}`,
    successUrl,
    cancelUrl,
  });

  db.prepare(
    "INSERT INTO stripe_payment_sessions (id, matterId, purpose, invoiceId, trustAccountId, amount, status, createdAt) VALUES (?, ?, 'invoice', ?, NULL, ?, 'pending', ?)",
  ).run(session.id, matterId, invoiceId, invoice.total, new Date().toISOString());

  return { url: session.url };
}

// Client-initiated (see /api/portal/matters/[id]/trust-deposit) — an
// advance/retainer payment, not yet earned, so it must land in the trust
// account rather than being treated as invoice revenue. Always deposits
// into the firm's first trust account — this app doesn't yet expose a way
// for a client-facing payment to choose among several trust accounts, a
// real limitation for a firm running more than one.
export async function createTrustDepositSession(
  matterId: string,
  amount: number,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string }> {
  if (!(amount > 0)) throw new Error("Amount must be greater than zero");
  const matter = await getMatter(matterId);
  if (!matter) throw new Error("Matter not found");
  const accounts = await listTrustAccounts();
  const trustAccount = accounts[0];
  if (!trustAccount) throw new Error("No trust account is set up yet — ask your lawyer to set one up first.");

  const session = await createCheckoutSession({
    amount,
    description: `Trust deposit — ${matter.title}`,
    successUrl,
    cancelUrl,
  });

  db.prepare(
    "INSERT INTO stripe_payment_sessions (id, matterId, purpose, invoiceId, trustAccountId, amount, status, createdAt) VALUES (?, ?, 'trust_deposit', NULL, ?, ?, 'pending', ?)",
  ).run(session.id, matterId, trustAccount.id, amount, new Date().toISOString());

  return { url: session.url };
}

// Idempotent — safe to call from the success-page redirect AND from
// stripePaymentScheduler.ts's poll for the same session; whichever gets
// there first marks it completed, the other is a no-op.
export async function finalizeStripeSession(sessionId: string): Promise<void> {
  const row = getSessionRow(sessionId);
  if (!row || row.status === "completed") return;

  const stripeSession = await getCheckoutSession(sessionId);
  if (!stripeSession.paid) return;

  if (row.purpose === "invoice" && row.invoiceId) {
    await updateInvoiceStatus(row.matterId, row.invoiceId, "paid");
    await recordAuditEvent(
      "invoice_paid_online",
      row.matterId,
      `Invoice paid online via Stripe ($${row.amount.toFixed(2)})`,
    );
  } else if (row.purpose === "trust_deposit" && row.trustAccountId) {
    await recordTrustTransaction({
      trustAccountId: row.trustAccountId,
      matterId: row.matterId,
      type: "deposit",
      amount: row.amount,
      description: "Client trust deposit paid online via Stripe",
      transactionDate: new Date().toISOString().slice(0, 10),
      userId: null,
    });
  }

  db.prepare("UPDATE stripe_payment_sessions SET status = 'completed', completedAt = ? WHERE id = ?").run(
    new Date().toISOString(),
    sessionId,
  );
}

// Polled by stripePaymentScheduler.ts for sessions whose success-page
// redirect never happened (tab closed, connection dropped) — anything
// still pending after a few minutes is worth a follow-up check against
// Stripe's own record of what actually happened.
export async function listPendingStripeSessionIds(): Promise<string[]> {
  const rows = db.prepare("SELECT id FROM stripe_payment_sessions WHERE status = 'pending'").all() as { id: string }[];
  return rows.map((r) => r.id);
}
