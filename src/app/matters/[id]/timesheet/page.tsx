import { listDisbursements } from "@/lib/disbursements";
import { getMatter, listInvoices, listTimeEntries } from "@/lib/matters";
import { isEmailConfigured } from "@/lib/email";
import { listSignableDocuments } from "@/lib/signableDocuments";
import TimesheetPanel from "@/components/TimesheetPanel";

export default async function MatterTimesheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [matter, timeEntries, disbursements, invoices, emailConfigured, signableDocuments] = await Promise.all([
    getMatter(id),
    listTimeEntries(id),
    listDisbursements(id),
    listInvoices(id),
    isEmailConfigured(),
    listSignableDocuments(id),
  ]);

  return (
    <TimesheetPanel
      matterId={id}
      initialEntries={timeEntries}
      initialDisbursements={disbursements}
      initialInvoices={invoices}
      clientEmail={matter?.clientEmail ?? null}
      emailConfigured={emailConfigured}
      initialHourlyRate={matter?.hourlyRate ?? null}
      initialSignableDocuments={signableDocuments}
    />
  );
}
