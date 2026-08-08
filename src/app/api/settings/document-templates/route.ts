import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createDocumentTemplate, listDocumentTemplates } from "@/lib/documentTemplates";

export async function GET() {
  return NextResponse.json(await listDocumentTemplates());
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (typeof body?.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  try {
    const template = await createDocumentTemplate({
      name: body.name,
      description: typeof body.description === "string" ? body.description : null,
      content: body.content,
      createdByUserId: user?.id ?? null,
    });
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create template" },
      { status: 400 },
    );
  }
}
