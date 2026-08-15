import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientSessionUser } from "@/lib/clientAuth";
import { getMatter } from "@/lib/matters";
import { createInvoicePaymentSession } from "@/lib/payments";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  const { id, invoiceId } = await params;
  const token = (await cookies()).get("client_session")?.value;
  const clientUser = await getClientSessionUser(token);
  if (!clientUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const matter = await getMatter(id);
  if (!matter || matter.clientId !== clientUser.clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/portal/matters/${id}?stripeSession={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/portal/matters/${id}`;

  try {
    const session = await createInvoicePaymentSession(id, invoiceId, successUrl, cancelUrl);
    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start payment" }, { status: 400 });
  }
}
