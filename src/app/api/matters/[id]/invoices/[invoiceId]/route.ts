import { NextResponse } from "next/server";
import { updateInvoiceStatus } from "@/lib/matters";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  const { id, invoiceId } = await params;
  const body = await request.json();
  const status = body?.status;

  if (status !== "paid" && status !== "unpaid") {
    return NextResponse.json({ error: "status must be 'paid' or 'unpaid'" }, { status: 400 });
  }

  const invoice = await updateInvoiceStatus(id, invoiceId, status);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  return NextResponse.json(invoice);
}
