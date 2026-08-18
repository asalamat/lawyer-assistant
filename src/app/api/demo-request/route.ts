import { NextResponse } from "next/server";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { checkPublicLeadRateLimit } from "@/lib/publicLeadForm";

// The demo-request form on the public marketing page (public/landing.html)
// — a prospective firm shopping for the software, not a prospective client
// of a firm using it, so this deliberately doesn't touch the leads/CRM
// pipeline (see /api/leads/public) which is for that other, unrelated use
// case. No DB row either: the whole point is a direct email, and there's
// nowhere in the app to review a stored list of these anyway. Reuses the
// same per-IP rate limiter as /api/leads/public — both are the same shape
// of problem (an anonymous, unauthenticated public write), just for a
// different destination.
const DEMO_REQUEST_RECIPIENT = "info@unityworkscanada.ca";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkPublicLeadRateLimit(ip)) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const firmName = typeof body?.firmName === "string" ? body.firmName.trim() : "";
  const practiceAreas = typeof body?.practiceAreas === "string" ? body.practiceAreas.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!(await isEmailConfigured())) {
    return NextResponse.json(
      { error: `This form isn't accepting submissions right now — email ${DEMO_REQUEST_RECIPIENT} directly.` },
      { status: 503 },
    );
  }

  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    firmName && `Firm: ${firmName}`,
    practiceAreas && `Practice area(s): ${practiceAreas}`,
    message && `Message:\n${message}`,
  ].filter((line): line is string => Boolean(line));

  try {
    await sendEmail({
      to: DEMO_REQUEST_RECIPIENT,
      subject: `Demo request — ${name}${firmName ? ` (${firmName})` : ""}`,
      text: lines.join("\n\n"),
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;">${lines
        .map((line) => `<p>${line.replace(/\n/g, "<br>")}</p>`)
        .join("")}</div>`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : `Failed to send — please email ${DEMO_REQUEST_RECIPIENT} directly.` },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
