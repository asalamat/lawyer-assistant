import { NextResponse } from "next/server";
import { listClients } from "@/lib/clients";

export async function GET() {
  return NextResponse.json(await listClients());
}
