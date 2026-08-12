import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requestInvoiceApproval } from "@/lib/matters";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  const { id, invoiceId } = await params;
  const user = await getCurrentUser();
  try {
    const origin = new URL(request.url).origin;
    const { invoice, signUrl, emailedTo, docusignEnvelopeId } = await requestInvoiceApproval(
      id,
      invoiceId,
      user?.id ?? null,
      origin,
    );
    return NextResponse.json({ invoice, signUrl, emailedTo, docusignEnvelopeId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to request approval" },
      { status: 400 },
    );
  }
}
