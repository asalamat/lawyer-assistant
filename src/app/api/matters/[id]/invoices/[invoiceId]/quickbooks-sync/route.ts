import { NextResponse } from "next/server";
import { syncInvoiceToQuickBooks } from "@/lib/matters";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  const { id, invoiceId } = await params;
  try {
    const invoice = await syncInvoiceToQuickBooks(id, invoiceId);
    return NextResponse.json(invoice);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 400 });
  }
}
