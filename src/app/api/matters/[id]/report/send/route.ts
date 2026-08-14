import { NextResponse } from "next/server";
import { recordAuditEvent } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email";
import { buildMatterReport } from "@/lib/matterReport";
import { getMatter } from "@/lib/matters";
import { getSmtpConfig } from "@/lib/settings";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

  const report = await buildMatterReport(id);
  if (!report) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }
  if (report.sections.length === 0) {
    return NextResponse.json({ error: "Nothing generated for this matter yet — there's nothing to send." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const to = (typeof body.to === "string" && body.to.trim()) || matter.clientEmail;
  if (!to || !to.includes("@")) {
    return NextResponse.json(
      { error: "No recipient email. Add a client email to the matter or provide one." },
      { status: 400 },
    );
  }

  const smtp = await getSmtpConfig();
  if (!smtp) {
    return NextResponse.json(
      { error: "Email is not configured. Set up SMTP in Settings > Email first." },
      { status: 400 },
    );
  }

  const subject = `${report.matterTitle} — Full matter report`;
  const text = report.sections.map((s) => `${s.heading}\n${"=".repeat(s.heading.length)}\n\n${s.content}`).join("\n\n");
  // Left as pre-formatted markdown rather than rendered HTML — Next.js route
  // handlers can't import react-dom/server (the same renderer
  // MarkdownContent.tsx uses client-side), and Tailwind's stylesheet isn't
  // loaded in an email client anyway, so a styled render wouldn't look
  // meaningfully better than readable monospace source.
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:640px;">
      <h1 style="margin-bottom:2px;">${escapeHtml(report.matterTitle)}</h1>
      <p style="margin:0;color:#555;">File ${escapeHtml(report.fileNumber)}</p>
      ${report.sections
        .map(
          (s) => `
        <h2 style="margin-top:28px;border-bottom:2px solid #eee;padding-bottom:4px;">${escapeHtml(s.heading)}</h2>
        <pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;">${escapeHtml(s.content)}</pre>`,
        )
        .join("")}
    </div>`;

  try {
    await sendEmail({ to, subject, text, html });
    await recordAuditEvent("matter_report_sent", id, `Emailed full matter report to ${to}`);
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
