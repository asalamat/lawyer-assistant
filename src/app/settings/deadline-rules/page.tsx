import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listDeadlineRules, listHolidays } from "@/lib/deadlineRules";
import { getOrCreateCalendarFeedSecret } from "@/lib/settings";
import { DeadlineIcon } from "@/components/icons";
import CalendarFeedPanel from "@/components/CalendarFeedPanel";
import DeadlineRulesPanel from "@/components/DeadlineRulesPanel";
import SettingsSection from "@/components/SettingsSection";

export const dynamic = "force-dynamic";

export default async function DeadlineRulesSettingsPage() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") redirect("/settings/security");

  const [rules, holidays, calendarFeedSecret] = await Promise.all([
    listDeadlineRules(),
    listHolidays(),
    getOrCreateCalendarFeedSecret(),
  ]);

  return (
    <SettingsSection
      title="Deadline rules"
      description="Reusable rules for the deadline calculator (e.g. '21 days after service, business days') and the holiday list used for business-day counting. There's no licensed jurisdiction rules database behind this — you're responsible for keeping these accurate for your own practice."
      icon={DeadlineIcon}
    >
      <div className="flex flex-col gap-6">
        <CalendarFeedPanel initialSecret={calendarFeedSecret} />
        <DeadlineRulesPanel initialRules={rules} initialHolidays={holidays} />
      </div>
    </SettingsSection>
  );
}
