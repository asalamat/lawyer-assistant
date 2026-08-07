import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { beginTotpEnrollment, getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enrollment = await beginTotpEnrollment(user.id);
  // Rendered server-side as a data URI so no QR-rendering code (or the
  // otpauth URI, which embeds the secret) needs to touch a third party —
  // this stays entirely within the request/response the browser already trusts.
  const qrCodeDataUri = await QRCode.toDataURL(enrollment.otpAuthUri, { margin: 1, width: 240 });
  return NextResponse.json({ ...enrollment, qrCodeDataUri });
}
