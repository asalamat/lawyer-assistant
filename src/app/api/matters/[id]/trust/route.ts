import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMatter } from "@/lib/matters";
import {
  getMatterTrustBalance,
  listMatterTrustTransactions,
  listTrustAccounts,
  recordTrustTransaction,
} from "@/lib/trustAccounting";
import { TRUST_TRANSACTION_TYPES, type TrustTransactionType } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [balance, transactions, accounts] = await Promise.all([
    getMatterTrustBalance(id),
    listMatterTrustTransactions(id),
    listTrustAccounts(),
  ]);
  return NextResponse.json({ balance, transactions, accounts });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const user = await getCurrentUser();
  const body = await request.json().catch(() => null);
  const trustAccountId = body?.trustAccountId;
  const type: TrustTransactionType = body?.type;
  const amount = Number(body?.amount);
  const description = body?.description;
  const transactionDate = body?.transactionDate;

  if (typeof trustAccountId !== "string" || !trustAccountId) {
    return NextResponse.json({ error: "trustAccountId is required" }, { status: 400 });
  }
  if (!TRUST_TRANSACTION_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${TRUST_TRANSACTION_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }
  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  if (typeof transactionDate !== "string" || !transactionDate) {
    return NextResponse.json({ error: "transactionDate is required" }, { status: 400 });
  }

  try {
    const transaction = await recordTrustTransaction({
      trustAccountId,
      matterId: id,
      type,
      amount,
      description,
      transactionDate,
      userId: user?.id ?? null,
    });
    return NextResponse.json(transaction, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record transaction" },
      { status: 400 },
    );
  }
}
