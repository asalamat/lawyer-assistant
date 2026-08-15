import { getQuickBooksStatus } from "@/lib/settings";
import SettingsSection from "@/components/SettingsSection";
import QuickBooksSettingsForm from "@/components/QuickBooksSettingsForm";
import { IntegrationIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function QuickBooksSettingsPage() {
  const status = await getQuickBooksStatus();

  return (
    <SettingsSection
      title="QuickBooks Online"
      description="Push invoices to QuickBooks Online as they're created here, and mark them paid there once they're paid here. One-way sync — this app stays the source of truth for matters/billing, QuickBooks becomes the bookkeeping mirror."
      icon={IntegrationIcon}
    >
      <QuickBooksSettingsForm initialStatus={status} />
    </SettingsSection>
  );
}
