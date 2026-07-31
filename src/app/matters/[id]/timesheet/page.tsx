import { listTimeEntries } from "@/lib/matters";
import TimesheetPanel from "@/components/TimesheetPanel";

export default async function MatterTimesheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const timeEntries = await listTimeEntries(id);

  return <TimesheetPanel matterId={id} initialEntries={timeEntries} />;
}
