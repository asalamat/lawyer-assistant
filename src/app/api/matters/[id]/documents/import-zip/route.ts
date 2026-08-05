import { NextResponse } from "next/server";
import { bulkImportZip } from "@/lib/bulkImport";
import { getMatter } from "@/lib/matters";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const results = await bulkImportZip(id, buffer);
    return NextResponse.json(results, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import zip" },
      { status: 400 },
    );
  }
}
