import { getCurrentUser } from "@/lib/auth";
import { getTrustAccountBalance, listTrustAccounts } from "@/lib/trustAccounting";
import TrustAccountsPanel from "@/components/TrustAccountsPanel";

export const dynamic = "force-dynamic";

export default async function TrustAccountingPage() {
  const user = await getCurrentUser();
  const accounts = await listTrustAccounts();
  const withBalances = await Promise.all(
    accounts.map(async (account) => ({ ...account, balance: await getTrustAccountBalance(account.id) })),
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl italic">Trust accounting</h1>
        <p className="mt-1 text-sm text-muted">
          Bookkeeping support for client trust funds — not accounting or tax advice. Verify this
          against your bar&apos;s trust-accounting rules before relying on it for a real audit.
        </p>
      </div>
      <TrustAccountsPanel initialAccounts={withBalances} canManage={user ? user.role !== "staff" : false} />
    </main>
  );
}
