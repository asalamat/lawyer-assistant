import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listTrustReconciliations, reconcileTrustAccount } from "@/lib/trustAccounting";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await listTrustReconciliations(id));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role === "staff") {
    return NextResponse.json({ error: "Only admins and lawyers can reconcile trust accounts" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const bankBalance = Number(body?.bankBalance);
  const statementDate = body?.statementDate;
  if (!Number.isFinite(bankBalance)) {
    return NextResponse.json({ error: "bankBalance must be a number" }, { status: 400 });
  }
  if (typeof statementDate !== "string" || !statementDate) {
    return NextResponse.json({ error: "statementDate is required" }, { status: 400 });
  }

  const reconciliation = await reconcileTrustAccount(id, bankBalance, statementDate, user.id);
  return NextResponse.json(reconciliation, { status: 201 });
}
