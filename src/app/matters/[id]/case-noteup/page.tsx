import { listCaseNoteups } from "@/lib/caseNoteup";
import CaseNoteupPanel from "@/components/CaseNoteupPanel";

export default async function MatterCaseNoteupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const noteups = await listCaseNoteups(id);

  return <CaseNoteupPanel matterId={id} initialNoteups={noteups} />;
}
