import QRCode from "qrcode";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const url = body?.url;
  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  // Only ever encode a same-origin-shaped URL the browser itself reported
  // (see AppQrCode.tsx) — not an arbitrary caller-supplied string rendered
  // as a scannable code.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "url is not a valid URL" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "url must be http or https" }, { status: 400 });
  }

  const dataUri = await QRCode.toDataURL(parsed.toString(), { margin: 1, width: 240 });
  return NextResponse.json({ dataUri });
}
