import { NextResponse } from "next/server";
import { getDisclosurePackageStatus } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await getDisclosurePackageStatus(id));
}
