import { listCampaigns } from "@/lib/campaigns";
import { getOrCreateCronSecret } from "@/lib/settings";
import { MailIcon } from "@/components/icons";
import CampaignsPanel from "@/components/CampaignsPanel";
import SettingsSection from "@/components/SettingsSection";

export const dynamic = "force-dynamic";

export default async function CampaignsSettingsPage() {
  const [campaigns, cronSecret] = await Promise.all([listCampaigns(), getOrCreateCronSecret()]);

  return (
    <SettingsSection
      title="Marketing campaigns"
      description={
        "An email sequence that auto-enrolls a lead the moment it reaches a chosen stage — " +
        'e.g. every lead marked "Contacted" gets a 3-email drip over two weeks. ' +
        "Requires SMTP configured in Settings > Email. Admin-only."
      }
      icon={MailIcon}
    >
      <CampaignsPanel initialCampaigns={campaigns} cronSecret={cronSecret} />
    </SettingsSection>
  );
}
