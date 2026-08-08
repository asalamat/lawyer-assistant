import { getMatter } from "@/lib/matters";
import { listPortalMessages } from "@/lib/portalMessages";
import MatterMessagesPanel from "@/components/MatterMessagesPanel";

export default async function MatterMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  const messages = await listPortalMessages(id);

  return <MatterMessagesPanel matterId={id} hasClientPortal={Boolean(matter?.clientId)} initialMessages={messages} />;
}
