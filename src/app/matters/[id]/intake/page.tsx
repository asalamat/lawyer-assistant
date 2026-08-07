import { INTAKE_QUESTIONS, listIntakeResponses, parseIntakeAnswers } from "@/lib/intake";
import IntakePanel from "@/components/IntakePanel";

export default async function MatterIntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const responses = await listIntakeResponses(id);

  return (
    <div className="flex flex-col gap-4">
      <IntakePanel matterId={id} />

      {responses.length === 0 ? (
        <p className="surface-card text-sm text-muted">
          No intake questionnaires sent for this matter yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {responses.map((response) => {
            const answers = parseIntakeAnswers(response);
            return (
              <li key={response.id} className="surface-card flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      response.status === "completed"
                        ? "badge bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                        : "badge"
                    }
                  >
                    {response.status === "completed" ? "Completed" : "Awaiting client"}
                  </span>
                  <span className="text-xs text-muted">
                    Sent {new Date(response.sentAt ?? response.createdAt).toLocaleString()}
                  </span>
                </div>

                {response.status === "completed" ? (
                  <>
                    <p className="text-sm">
                      {response.clientName}
                      {response.clientEmail ? ` · ${response.clientEmail}` : ""}
                      <span className="text-muted">
                        {" "}
                        · completed{" "}
                        {response.completedAt
                          ? new Date(response.completedAt).toLocaleString()
                          : "—"}
                      </span>
                    </p>
                    <dl className="flex flex-col gap-2 text-sm">
                      {INTAKE_QUESTIONS.map((question) => (
                        <div key={question.id} className="surface-row">
                          <dt className="text-xs text-muted">{question.label}</dt>
                          <dd className="whitespace-pre-wrap">
                            {answers?.[question.id]?.trim() || "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    The client hasn&apos;t submitted their answers yet.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
