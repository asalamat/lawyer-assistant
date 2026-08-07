import { NextResponse } from "next/server";
import { getIntakeResponse, parseIntakeAnswers, INTAKE_QUESTIONS } from "@/lib/intake";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; responseId: string }> },
) {
  const { id, responseId } = await params;
  const response = await getIntakeResponse(responseId);
  if (!response || response.matterId !== id) {
    return NextResponse.json({ error: "Intake questionnaire not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...response,
    questions: INTAKE_QUESTIONS,
    answers: parseIntakeAnswers(response),
  });
}
