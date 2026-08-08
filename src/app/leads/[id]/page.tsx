import { notFound } from "next/navigation";
import { getLead } from "@/lib/leads";
import LeadDetailPanel from "@/components/LeadDetailPanel";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <LeadDetailPanel initialLead={lead} />
    </main>
  );
}
