import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { getMatter, recordMatterEmailSent } from "@/lib/matters";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const body = await request.json();
  const { to, subject, message } = body ?? {};

  if (typeof to !== "string" || !to.includes("@")) {
    return NextResponse.json({ error: "A valid recipient email is required" }, { status: 400 });
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  try {
    await sendEmail({ to, subject, text: message });
    await recordMatterEmailSent(id, to, subject);
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
}
