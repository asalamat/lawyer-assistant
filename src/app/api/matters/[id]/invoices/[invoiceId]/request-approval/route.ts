import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requestInvoiceApproval } from "@/lib/matters";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  const { id, invoiceId } = await params;
  const user = await getCurrentUser();
  try {
    const { invoice, signUrl } = await requestInvoiceApproval(id, invoiceId, user?.id ?? null);
    return NextResponse.json({ invoice, signUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to request approval" },
      { status: 400 },
    );
  }
}
