import { NextResponse } from "next/server";
import { deleteTask, getTask, toggleTaskComplete, updateTask } from "@/lib/tasks";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { taskId } = await params;
  const body = await request.json().catch(() => null);

  try {
    if (typeof body?.completed === "boolean") {
      const task = await toggleTaskComplete(taskId, body.completed);
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      return NextResponse.json(task);
    }

    const task = await updateTask(taskId, {
      title: typeof body?.title === "string" ? body.title : undefined,
      description: body?.description !== undefined ? body.description : undefined,
      dueDate: body?.dueDate !== undefined ? body.dueDate : undefined,
      assignedToUserId: body?.assignedToUserId !== undefined ? body.assignedToUserId : undefined,
    });
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    return NextResponse.json(task);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update task" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { taskId } = await params;
  const existing = await getTask(taskId);
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  await deleteTask(taskId);
  return NextResponse.json({ success: true });
}
