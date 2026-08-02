import { getMatter } from "@/lib/matters";
import { isEmailConfigured } from "@/lib/email";
import ComposeEmailPanel from "@/components/ComposeEmailPanel";
import ImportEmailPanel from "@/components/ImportEmailPanel";

export default async function MatterEmailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  const emailConfigured = await isEmailConfigured();

  return (
    <div className="flex flex-col gap-4">
      <ComposeEmailPanel
        matterId={id}
        clientEmail={matter?.clientEmail ?? null}
        emailConfigured={emailConfigured}
      />
      <ImportEmailPanel matterId={id} />
    </div>
  );
}
