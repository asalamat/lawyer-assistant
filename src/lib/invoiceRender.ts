import { formatDateOnly } from "./formatDate";
import type { Disbursement, Invoice, Matter, TimeEntry } from "./types";

function currency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function renderInvoiceText(
  invoice: Invoice,
  matter: Matter,
  entries: TimeEntry[],
  fromName: string,
  disbursements: Disbursement[] = [],
): string {
  const lines: string[] = [
    `INVOICE ${invoice.invoiceNumber}`,
    `Date: ${formatDateOnly(invoice.createdAt.slice(0, 10))}`,
    "",
    `Matter: ${matter.title} (${matter.fileNumber})`,
    `Client: ${matter.clientName}`,
    "",
    "Time entries:",
  ];
  for (const entry of entries) {
    lines.push(
      `  ${formatDateOnly(entry.workedOn)}  ${entry.description}  —  ${entry.hours.toFixed(1)}h @ ${currency(invoice.hourlyRate)} = ${currency(entry.hours * invoice.hourlyRate)}`,
    );
  }
  lines.push("");
  lines.push(`Subtotal (${invoice.hours.toFixed(1)}h): ${currency(invoice.subtotal)}`);
  if (disbursements.length > 0) {
    lines.push("", "Disbursements:");
    for (const d of disbursements) {
      lines.push(`  ${formatDateOnly(d.incurredOn)}  ${d.category}: ${d.description}  —  ${currency(d.amount)}`);
    }
    lines.push(`Disbursements total: ${currency(invoice.disbursementsTotal)}`);
  }
  if (invoice.discount > 0) lines.push(`Discount: -${currency(invoice.discount)}`);
  lines.push(`Total due: ${currency(invoice.total)}`);
  lines.push("");
  if (fromName) lines.push(`From: ${fromName}`);
  return lines.join("\n");
}

export function renderInvoiceHtml(
  invoice: Invoice,
  matter: Matter,
  entries: TimeEntry[],
  fromName: string,
  disbursements: Disbursement[] = [],
): string {
  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${formatDateOnly(entry.workedOn)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(entry.description)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${entry.hours.toFixed(1)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${currency(invoice.hourlyRate)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${currency(entry.hours * invoice.hourlyRate)}</td>
      </tr>`,
    )
    .join("");

  const disbursementRows = disbursements
    .map(
      (d) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;" colspan="2">${formatDateOnly(d.incurredOn)} — ${escapeHtml(d.category)}: ${escapeHtml(d.description)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;" colspan="2"></td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${currency(d.amount)}</td>
      </tr>`,
    )
    .join("");

  const discountRow =
    invoice.discount > 0
      ? `<tr><td colspan="4" style="padding:4px 10px;text-align:right;">Discount</td><td style="padding:4px 10px;text-align:right;">-${currency(invoice.discount)}</td></tr>`
      : "";

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:640px;">
    <h2 style="margin-bottom:2px;">Invoice ${invoice.invoiceNumber}</h2>
    <p style="margin:0;color:#555;">Date: ${formatDateOnly(invoice.createdAt.slice(0, 10))}</p>
    <p style="margin:12px 0 0;"><strong>Matter:</strong> ${escapeHtml(matter.title)} (${escapeHtml(matter.fileNumber)})<br/>
    <strong>Client:</strong> ${escapeHtml(matter.clientName)}</p>
    <table style="border-collapse:collapse;width:100%;margin-top:16px;font-size:14px;">
      <thead>
        <tr style="background:#f4f1ea;">
          <th style="padding:8px 10px;text-align:left;">Date</th>
          <th style="padding:8px 10px;text-align:left;">Description</th>
          <th style="padding:8px 10px;text-align:right;">Hours</th>
          <th style="padding:8px 10px;text-align:right;">Rate</th>
          <th style="padding:8px 10px;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr><td colspan="4" style="padding:8px 10px;text-align:right;">Subtotal (${invoice.hours.toFixed(1)}h)</td><td style="padding:8px 10px;text-align:right;">${currency(invoice.subtotal)}</td></tr>
        ${disbursementRows}
        ${disbursements.length > 0 ? `<tr><td colspan="4" style="padding:8px 10px;text-align:right;">Disbursements total</td><td style="padding:8px 10px;text-align:right;">${currency(invoice.disbursementsTotal)}</td></tr>` : ""}
        ${discountRow}
        <tr style="font-weight:bold;"><td colspan="4" style="padding:8px 10px;text-align:right;border-top:2px solid #333;">Total due</td><td style="padding:8px 10px;text-align:right;border-top:2px solid #333;">${currency(invoice.total)}</td></tr>
      </tbody>
    </table>
    ${fromName ? `<p style="margin-top:20px;color:#555;">From: ${escapeHtml(fromName)}</p>` : ""}
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
