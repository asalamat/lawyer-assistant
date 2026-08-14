import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addDisbursement, listDisbursements } from "@/lib/disbursements";
import { addDocument, getMatter } from "@/lib/matters";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const disbursements = await listDisbursements(id);
  return NextResponse.json(disbursements);
}

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
  const incurredOn = formData.get("incurredOn");
  const category = formData.get("category");
  const description = formData.get("description");
  const amount = formData.get("amount");
  const receiptFile = formData.get("receipt");

  if (typeof incurredOn !== "string" || !incurredOn.trim()) {
    return NextResponse.json({ error: "incurredOn date is required" }, { status: 400 });
  }
  if (typeof category !== "string" || !category.trim()) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }
  if (typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
  }

  let receiptDocumentId: string | null = null;
  if (receiptFile instanceof File) {
    const document = await addDocument(id, receiptFile);
    receiptDocumentId = document.id;
  }

  const user = await getCurrentUser();
  const disbursement = await addDisbursement(id, {
    incurredOn,
    category: category.trim(),
    description: description.trim(),
    amount: parsedAmount,
    receiptDocumentId,
    userId: user?.id ?? null,
  });
  return NextResponse.json(disbursement, { status: 201 });
}
