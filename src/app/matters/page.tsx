import { listMatters } from "@/lib/matters";
import MatterList from "@/components/MatterList";

export const dynamic = "force-dynamic";

export default async function MattersPage() {
  const matters = await listMatters();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Matters</h1>
      <MatterList matters={matters} />
    </main>
  );
}
