import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTrustAccount, getTrustAccountBalance, listTrustAccounts } from "@/lib/trustAccounting";

export async function GET() {
  const accounts = await listTrustAccounts();
  const withBalances = await Promise.all(
    accounts.map(async (account) => ({ ...account, balance: await getTrustAccountBalance(account.id) })),
  );
  return NextResponse.json(withBalances);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "staff") {
    return NextResponse.json({ error: "Only admins and lawyers can create trust accounts" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const account = await createTrustAccount({
      name: body.name,
      bankName: typeof body.bankName === "string" ? body.bankName : null,
      accountLast4: typeof body.accountLast4 === "string" ? body.accountLast4 : null,
    });
    return NextResponse.json(account, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create trust account" },
      { status: 400 },
    );
  }
}
