import { listDeadlineRules } from "@/lib/deadlineRules";
import { listDeadlines } from "@/lib/matters";
import DeadlinesPanel from "@/components/DeadlinesPanel";

export default async function MatterDeadlinesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [deadlines, rules] = await Promise.all([listDeadlines(id), listDeadlineRules()]);

  return <DeadlinesPanel matterId={id} initialDeadlines={deadlines} rules={rules} />;
}
