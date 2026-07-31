import { NextResponse } from "next/server";
import { createInvoice, listInvoices } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const invoices = await listInvoices(id);
  return NextResponse.json(invoices);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { entryIds, hourlyRate, discount } = body ?? {};

  if (!Array.isArray(entryIds) || entryIds.some((e) => typeof e !== "string") || entryIds.length === 0) {
    return NextResponse.json({ error: "entryIds must be a non-empty array of strings" }, { status: 400 });
  }
  const parsedRate = Number(hourlyRate);
  if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
    return NextResponse.json({ error: "hourlyRate must be a positive number" }, { status: 400 });
  }
  const parsedDiscount = Number(discount ?? 0);
  if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) {
    return NextResponse.json({ error: "discount must be zero or a positive number" }, { status: 400 });
  }

  try {
    const invoice = await createInvoice(id, {
      entryIds,
      hourlyRate: parsedRate,
      discount: parsedDiscount,
    });
    return NextResponse.json(invoice, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
