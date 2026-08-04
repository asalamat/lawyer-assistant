import { getCanliiApiKeyStatus, getOrCreateCronSecret } from "@/lib/settings";
import { listLegislationWatches } from "@/lib/legislationWatch";
import CanliiTestButton from "@/components/CanliiTestButton";
import LegislationWatchPanel from "@/components/LegislationWatchPanel";
import SettingsForm from "@/components/SettingsForm";
import SettingsSection from "@/components/SettingsSection";
import { EvidenceIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LegalResearchSettingsPage() {
  const status = await getCanliiApiKeyStatus();
  const watches = await listLegislationWatches();
  const cronSecret = await getOrCreateCronSecret();

  return (
    <SettingsSection
      title="Legal research (CanLII)"
      description="Looks up case metadata and citation history (note-up) from CanLII's database. Note: CanLII's API only supports browsing known cases by ID and date, not free-text search by citation — full citation verification against case law is not yet built on top of this."
      icon={EvidenceIcon}
    >
      <SettingsForm
        initialStatus={status}
        title="CanLII API key"
        placeholder="Paste the key from CanLII's feedback-form response"
        apiPath="/api/settings/canlii"
        bodyKey="canliiApiKey"
      />
      {status.configured && <CanliiTestButton />}
      <LegislationWatchPanel initialWatches={watches} cronSecret={cronSecret} />
    </SettingsSection>
  );
}
