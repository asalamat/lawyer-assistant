import { getStripeStatus } from "@/lib/settings";
import SettingsSection from "@/components/SettingsSection";
import StripeSettingsForm from "@/components/StripeSettingsForm";
import { TrustIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function PaymentsSettingsPage() {
  const status = await getStripeStatus();

  return (
    <SettingsSection
      title="Payments"
      description="Connect Stripe so clients can pay an invoice or make a trust deposit online, from their portal. Card details never touch this app — payment happens on Stripe's own hosted page. An invoice payment is recorded as earned fees; a trust deposit is recorded separately as a trust-account deposit — the two are never mixed."
      icon={TrustIcon}
    >
      <StripeSettingsForm initialStatus={status} />
    </SettingsSection>
  );
}
