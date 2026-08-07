import { getCurrentUser } from "@/lib/auth";
import { listClients } from "@/lib/clients";
import { filterAccessibleMatterIds } from "@/lib/matterAccess";
import { listMatters } from "@/lib/matters";
import MatterList from "@/components/MatterList";

export const dynamic = "force-dynamic";

export default async function MattersPage() {
  const user = await getCurrentUser();
  const allMatters = await listMatters();
  const accessibleIds = user
    ? filterAccessibleMatterIds(user.id, user.role, allMatters.map((m) => m.id))
    : new Set(allMatters.map((m) => m.id));
  const matters = allMatters.filter((m) => accessibleIds.has(m.id));
  const clients = await listClients();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Matters</h1>
      <MatterList matters={matters} clients={clients} />
    </main>
  );
}
