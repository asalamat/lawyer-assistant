import { notFound } from "next/navigation";
import { getClient, listMattersForClient } from "@/lib/clients";
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
  const matters = await listMattersForClient(id);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-3xl italic">{client.name}</h1>
        {client.email && <p className="text-sm text-muted">{client.email}</p>}
      </div>

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
