import { listDeadlines } from "@/lib/matters";
import DeadlinesPanel from "@/components/DeadlinesPanel";

export default async function MatterDeadlinesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deadlines = await listDeadlines(id);

  return <DeadlinesPanel matterId={id} initialDeadlines={deadlines} />;
}
