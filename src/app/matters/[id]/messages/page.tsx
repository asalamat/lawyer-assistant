import { getClient } from "@/lib/clients";
import { getMatter, listSmsMessages } from "@/lib/matters";
import { listPortalMessages } from "@/lib/portalMessages";
import { isSmsConfigured } from "@/lib/sms";
import MatterMessagesPanel from "@/components/MatterMessagesPanel";
import SmsPanel from "@/components/SmsPanel";

export default async function MatterMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  const client = matter?.clientId ? await getClient(matter.clientId) : null;
  const [messages, smsMessages, smsConfigured] = await Promise.all([
    listPortalMessages(id),
    listSmsMessages(id),
    isSmsConfigured(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <MatterMessagesPanel matterId={id} hasClientPortal={Boolean(matter?.clientId)} initialMessages={messages} />
      <SmsPanel
        matterId={id}
        initialMessages={smsMessages}
        clientPhone={client?.phone ?? null}
        smsConfigured={smsConfigured}
      />
    </div>
  );
}
