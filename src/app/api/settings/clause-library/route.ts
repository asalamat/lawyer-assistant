import { NextResponse } from "next/server";
import { createClauseLibraryEntry, listClauseLibraryEntries } from "@/lib/clauseLibrary";

export async function GET() {
  return NextResponse.json(await listClauseLibraryEntries());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.clauseType !== "string" || !body.clauseType.trim()) {
    return NextResponse.json({ error: "clauseType is required" }, { status: 400 });
  }
  if (typeof body?.preferredLanguage !== "string" || !body.preferredLanguage.trim()) {
    return NextResponse.json({ error: "preferredLanguage is required" }, { status: 400 });
  }

  try {
    const entry = await createClauseLibraryEntry({
      clauseType: body.clauseType,
      preferredLanguage: body.preferredLanguage,
      fallbackLanguage: typeof body.fallbackLanguage === "string" ? body.fallbackLanguage : null,
      unacceptableLanguage: typeof body.unacceptableLanguage === "string" ? body.unacceptableLanguage : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create clause library entry" },
      { status: 400 },
    );
  }
}
