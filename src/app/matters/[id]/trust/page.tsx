import { getMatterTrustBalance, listMatterTrustTransactions, listTrustAccounts } from "@/lib/trustAccounting";
import MatterTrustPanel from "@/components/MatterTrustPanel";

export default async function MatterTrustPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [balance, transactions, accounts] = await Promise.all([
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
    />
  );
}
