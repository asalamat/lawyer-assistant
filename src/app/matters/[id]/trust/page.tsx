import { getMatter } from "@/lib/matters";
import { getMatterTrustBalance, listMatterTrustTransactions, listTrustAccounts } from "@/lib/trustAccounting";
import MatterTrustPanel from "@/components/MatterTrustPanel";

export default async function MatterTrustPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [matter, balance, transactions, accounts] = await Promise.all([
    getMatter(id),
    getMatterTrustBalance(id),
    listMatterTrustTransactions(id),
    listTrustAccounts(),
  ]);

  return (
    <MatterTrustPanel
      matterId={id}
      initialBalance={balance}
      initialTransactions={transactions}
      accounts={accounts}
      initialRetainerThreshold={matter?.retainerThreshold ?? null}
    />
  );
}
