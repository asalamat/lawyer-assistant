import { listCalendarItems } from "@/lib/calendar";
import CalendarView from "@/components/CalendarView";

export default async function MatterCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const items = await listCalendarItems(id);

  return <CalendarView initialItems={items} matterId={id} />;
}
