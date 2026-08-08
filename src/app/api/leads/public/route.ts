import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads";
import { checkPublicLeadRateLimit } from "@/lib/publicLeadForm";

// The one truly anonymous, no-session write path in this app — meant to be
// called from the embeddable form at /leads/public, itself meant to be
// <iframe>-embedded on the firm's own public website. See src/proxy.ts's
// PUBLIC_PATH_PREFIXES for the auth exemption.
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkPublicLeadRateLimit(ip)) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await createLead({
    name,
    email: typeof body?.email === "string" ? body.email.trim() || null : null,
    phone: typeof body?.phone === "string" ? body.phone.trim() || null : null,
    notes: typeof body?.message === "string" ? body.message.trim() || null : null,
    source: "website",
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
