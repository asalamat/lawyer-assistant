import { NextResponse } from "next/server";
import { addDisbursementCategory, getDisbursementCategories } from "@/lib/settings";

export async function GET() {
  const categories = await getDisbursementCategories();
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const category = body?.category;
  if (typeof category !== "string" || !category.trim()) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }
  try {
    const categories = await addDisbursementCategory(category);
    return NextResponse.json({ categories });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add category" }, { status: 400 });
  }
}
