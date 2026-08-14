import { NextResponse } from "next/server";
import { listInvoiceDisbursements } from "@/lib/disbursements";
import { sendEmail } from "@/lib/email";
import { getSmtpConfig } from "@/lib/settings";
import { getInvoice, getMatter, listInvoiceEntries, recordInvoiceSent } from "@/lib/matters";
import { renderInvoiceHtml, renderInvoiceText } from "@/lib/invoiceRender";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  const { id, invoiceId } = await params;
  const body = await request.json().catch(() => ({}));

  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }
  const invoice = await getInvoice(id, invoiceId);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const to = (typeof body.to === "string" && body.to.trim()) || matter.clientEmail;
  if (!to || !to.includes("@")) {
    return NextResponse.json(
      { error: "No recipient email. Add a client email to the matter or provide one." },
      { status: 400 },
    );
  }

  const smtp = await getSmtpConfig();
  if (!smtp) {
    return NextResponse.json(
      { error: "Email is not configured. Set up SMTP in Settings > Email first." },
      { status: 400 },
    );
  }

  const [entries, disbursements] = await Promise.all([
    listInvoiceEntries(invoiceId),
    listInvoiceDisbursements(invoiceId),
  ]);
  const subject = `Invoice ${invoice.invoiceNumber} — ${matter.title}`;

  try {
    await sendEmail({
      to,
      subject,
      text: renderInvoiceText(invoice, matter, entries, smtp.fromName, disbursements),
      html: renderInvoiceHtml(invoice, matter, entries, smtp.fromName, disbursements),
    });
    await recordInvoiceSent(id, invoice.invoiceNumber, to);
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
