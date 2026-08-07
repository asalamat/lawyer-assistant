import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getClient, listMattersForClient } from "@/lib/clients";
import { filterAccessibleMatterIds } from "@/lib/matterAccess";
import ClientDetailActions from "@/components/ClientDetailActions";
import MatterCard from "@/components/MatterCard";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const user = await getCurrentUser();
  const allMatters = await listMattersForClient(id);
  const accessibleIds = user
    ? filterAccessibleMatterIds(user.id, user.role, allMatters.map((m) => m.id))
    : new Set(allMatters.map((m) => m.id));
  const matters = allMatters.filter((m) => accessibleIds.has(m.id));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl italic">{client.name}</h1>
          {client.type !== "individual" && (
            <span className="badge capitalize">{client.type}</span>
          )}
        </div>
        {client.contactPerson && (
          <p className="text-sm text-muted">Contact: {client.contactPerson}</p>
        )}
        {client.registrationNumber && (
          <p className="text-sm text-muted">Registration/incorporation #: {client.registrationNumber}</p>
        )}
        {client.email && <p className="text-sm text-muted">{client.email}</p>}
        {client.phone && <p className="text-sm text-muted">{client.phone}</p>}
        {client.notes && <p className="mt-1 text-sm text-muted">{client.notes}</p>}
      </div>

      <ClientDetailActions client={client} matterCount={matters.length} />

      <div>
        <h2 className="mb-2 font-display text-lg">
          Matters ({matters.length})
        </h2>
        {matters.length === 0 ? (
          <p className="text-sm text-muted">No matters for this client yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {matters.map((matter) => (
              <MatterCard key={matter.id} matter={matter} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
