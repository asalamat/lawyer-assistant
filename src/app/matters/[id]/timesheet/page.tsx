import { getMatter, listInvoices, listTimeEntries } from "@/lib/matters";
import { isEmailConfigured } from "@/lib/email";
import TimesheetPanel from "@/components/TimesheetPanel";

export default async function MatterTimesheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [matter, timeEntries, invoices, emailConfigured] = await Promise.all([
    getMatter(id),
    listTimeEntries(id),
    listInvoices(id),
    isEmailConfigured(),
  ]);

  return (
    <TimesheetPanel
      matterId={id}
      initialEntries={timeEntries}
      initialInvoices={invoices}
      clientEmail={matter?.clientEmail ?? null}
      emailConfigured={emailConfigured}
      initialHourlyRate={matter?.hourlyRate ?? null}
    />
  );
}
