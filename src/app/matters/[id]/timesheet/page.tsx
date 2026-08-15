import { listDisbursements } from "@/lib/disbursements";
import { getMatter, listInvoices, listTimeEntries } from "@/lib/matters";
import { isEmailConfigured } from "@/lib/email";
import { isQuickBooksConnected } from "@/lib/quickbooks";
import { getDisbursementCategories } from "@/lib/settings";
import { listSignableDocuments } from "@/lib/signableDocuments";
import TimesheetPanel from "@/components/TimesheetPanel";

export default async function MatterTimesheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [
    matter,
    timeEntries,
    disbursements,
    disbursementCategories,
    invoices,
    emailConfigured,
    signableDocuments,
    quickBooksConnected,
  ] = await Promise.all([
    getMatter(id),
    listTimeEntries(id),
    listDisbursements(id),
    getDisbursementCategories(),
    listInvoices(id),
    isEmailConfigured(),
    listSignableDocuments(id),
    isQuickBooksConnected(),
  ]);

  return (
    <TimesheetPanel
      matterId={id}
      initialEntries={timeEntries}
      initialDisbursements={disbursements}
      initialDisbursementCategories={disbursementCategories}
      initialInvoices={invoices}
      clientEmail={matter?.clientEmail ?? null}
      emailConfigured={emailConfigured}
      initialHourlyRate={matter?.hourlyRate ?? null}
      initialSignableDocuments={signableDocuments}
      quickBooksConnected={quickBooksConnected}
    />
  );
}
