import { listWitnessPrepAnalyses } from "@/lib/matters";
import { listParties } from "@/lib/parties";
import WitnessPrepPanel from "@/components/WitnessPrepPanel";

export default async function MatterWitnessPrepPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [analyses, parties] = await Promise.all([listWitnessPrepAnalyses(id), listParties(id)]);
  const witnessNames = parties.filter((p) => p.role.toLowerCase().includes("witness")).map((p) => p.name);

  return <WitnessPrepPanel matterId={id} initialAnalyses={analyses} witnessNames={witnessNames} />;
}
