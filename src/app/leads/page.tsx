import { listActiveEnrollmentsByLeadId } from "@/lib/campaigns";
import { listLeads } from "@/lib/leads";
import LeadsBoard from "@/components/LeadsBoard";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const [leads, enrollmentByLeadId] = await Promise.all([listLeads(), listActiveEnrollmentsByLeadId()]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl italic">Leads</h1>
        <p className="mt-1 text-sm text-muted">
          Prospective clients before a matter exists. Convert a lead once it&apos;s ready to
          become a real matter.
        </p>
      </div>
      <LeadsBoard initialLeads={leads} enrollmentByLeadId={enrollmentByLeadId} />
    </main>
  );
}
