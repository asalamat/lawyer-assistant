import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/clientAccess";
import { getIntakeResponse, submitIntakeAnswers, INTAKE_QUESTIONS } from "@/lib/intake";

// Public, no-login route reached by a client from a link in an email — the
// expiring single-resource token IS the authentication, so nothing here
// consults the staff session. Responses deliberately carry no matter detail
// (no title, no file number, no documents): a leaked link should expose the
// questionnaire and nothing else about the file.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = getValidAccessToken(token, "intake");
  if (!access) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  }

  const response = await getIntakeResponse(access.resourceId);
  if (!response) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  }
  if (response.status === "completed") {
    return NextResponse.json(
      { error: "This questionnaire has already been submitted." },
      { status: 410 },
    );
  }

  return NextResponse.json({ questions: INTAKE_QUESTIONS });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const access = getValidAccessToken(token, "intake");
  if (!access) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const clientName = body?.clientName;
  if (typeof clientName !== "string" || !clientName.trim()) {
    return NextResponse.json({ error: "Your name is required" }, { status: 400 });
  }
  const clientEmail = body?.clientEmail;
  if (clientEmail !== undefined && clientEmail !== null && typeof clientEmail !== "string") {
    return NextResponse.json({ error: "Email must be text" }, { status: 400 });
  }

  try {
    await submitIntakeAnswers(access.resourceId, {
      clientName,
      clientEmail,
      answers: body?.answers,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit questionnaire" },
      { status: 400 },
    );
  }
}
