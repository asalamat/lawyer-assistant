import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { filterAccessibleMatterIds } from "@/lib/matterAccess";
import { createMatter, listMatters } from "@/lib/matters";

export async function GET() {
  const user = await getCurrentUser();
  const allMatters = await listMatters();
  if (!user) return NextResponse.json(allMatters);
  const accessibleIds = filterAccessibleMatterIds(user.id, user.role, allMatters.map((m) => m.id));
  return NextResponse.json(allMatters.filter((m) => accessibleIds.has(m.id)));
}

export async function POST(request: Request) {
  const body = await request.json();
  const { title, clientName, clientEmail, matterType, hourlyRate } = body ?? {};

  if (!title || !clientName || !matterType) {
    return NextResponse.json(
      { error: "title, clientName, and matterType are required" },
      { status: 400 },
    );
  }
  if (clientEmail && (typeof clientEmail !== "string" || !clientEmail.includes("@"))) {
    return NextResponse.json({ error: "clientEmail must be a valid email address" }, { status: 400 });
  }
  let parsedRate: number | undefined;
  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") {
    parsedRate = Number(hourlyRate);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      return NextResponse.json({ error: "hourlyRate must be a positive number" }, { status: 400 });
    }
  }

  const matter = await createMatter({ title, clientName, clientEmail, matterType, hourlyRate: parsedRate });
  return NextResponse.json(matter, { status: 201 });
}
