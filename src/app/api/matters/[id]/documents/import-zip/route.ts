import { NextResponse } from "next/server";
import { bulkImportZip } from "@/lib/bulkImport";
import { checkForNewDeadlines, checkMatterClassification, getMatter } from "@/lib/matters";

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

    // Deadline-monitoring agent: one check for the whole batch, not one
    // per file — a zip can contain dozens of files, and re-running full
    // deadline extraction after each would be needless repeated AI calls
    // for what's really one intake event. Best-effort, same as the
    // single-upload route.
    let newDeadlines = 0;
    let classificationSuggestion = null;
    if (results.some((r) => r.status === "uploaded")) {
      try {
        newDeadlines = (await checkForNewDeadlines(id)).newCount;
      } catch {
        newDeadlines = 0;
      }
      try {
        classificationSuggestion = await checkMatterClassification(id);
      } catch {
        classificationSuggestion = null;
      }
    }

    return NextResponse.json({ results, newDeadlines, classificationSuggestion }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import zip" },
      { status: 400 },
    );
  }
}
