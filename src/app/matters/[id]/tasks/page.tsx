import { listMatterTasks } from "@/lib/tasks";
import TasksPanel from "@/components/TasksPanel";

export default async function MatterTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tasks = await listMatterTasks(id);
  return <TasksPanel matterId={id} initialTasks={tasks} />;
}
