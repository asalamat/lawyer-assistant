import { NextResponse } from "next/server";
import { getAppVersion } from "@/lib/systemInfo";

export async function GET() {
  return NextResponse.json(await getAppVersion());
}
