import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createTask, listMatterTasks } from "@/lib/tasks";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(await listMatterTasks(id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const body = await request.json().catch(() => null);

  if (typeof body?.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Task title is required" }, { status: 400 });
  }

  try {
    const task = await createTask({
      matterId: id,
      title: body.title,
      description: typeof body.description === "string" ? body.description : null,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
      assignedToUserId: typeof body.assignedToUserId === "string" ? body.assignedToUserId : null,
      createdByUserId: user?.id ?? null,
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create task" },
      { status: 400 },
    );
  }
}
