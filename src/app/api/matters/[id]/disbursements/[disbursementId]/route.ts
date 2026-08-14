import { NextResponse } from "next/server";
import { deleteDisbursement } from "@/lib/disbursements";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; disbursementId: string }> },
) {
  const { id, disbursementId } = await params;
  try {
    await deleteDisbursement(id, disbursementId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
