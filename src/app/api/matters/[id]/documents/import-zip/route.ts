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
    // for what's really one intake event. Deliberately NOT awaited: both
    // checks read the matter's FULL document corpus, which made this
    // block the response for well over a minute on a data-rich matter in
    // testing. Runs in the background instead — the deadline list/
    // classification banner reflect the batch once it finishes, just not
    // synchronously with this response.
    if (results.some((r) => r.status === "uploaded")) {
      void checkForNewDeadlines(id).catch(() => {});
      void checkMatterClassification(id).catch(() => {});
    }

    return NextResponse.json({ results }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import zip" },
      { status: 400 },
    );
  }
}
