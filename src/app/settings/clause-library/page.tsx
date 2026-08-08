import { listClauseLibraryEntries } from "@/lib/clauseLibrary";
import { ScaleIcon } from "@/components/icons";
import ClauseLibraryPanel from "@/components/ClauseLibraryPanel";
import SettingsSection from "@/components/SettingsSection";

export const dynamic = "force-dynamic";

export default async function ClauseLibrarySettingsPage() {
  const entries = await listClauseLibraryEntries();

  return (
    <SettingsSection
      title="Clause library"
      description="A firm-wide contract playbook — preferred, fallback, and unacceptable language per clause type (e.g. Limitation of liability, Indemnification). A matter's own Redline tab compares an uploaded contract against this list."
      icon={ScaleIcon}
    >
      <ClauseLibraryPanel initialEntries={entries} />
    </SettingsSection>
  );
}
