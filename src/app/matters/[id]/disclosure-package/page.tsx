import { getDisclosurePackageStatus, listRedactionFlags } from "@/lib/matters";
import DisclosurePackagePanel from "@/components/DisclosurePackagePanel";

export default async function MatterDisclosurePackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [flags, pkg] = await Promise.all([listRedactionFlags(id), getDisclosurePackageStatus(id)]);

  return <DisclosurePackagePanel matterId={id} initialFlags={flags} initialPackage={pkg} />;
}
