import { listCalendarItems } from "@/lib/calendar";
import { listMatters } from "@/lib/matters";
import CalendarView from "@/components/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [items, matters] = await Promise.all([listCalendarItems(), listMatters()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl">Calendar</h1>
        <p className="text-sm text-muted">
          Every matter&apos;s deadlines, plus any firm-wide or matter-linked events you add here.
        </p>
      </div>
      <CalendarView initialItems={items} matters={matters.map((m) => ({ id: m.id, title: m.title }))} />
    </div>
  );
}
