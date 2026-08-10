"use client";

import { useEffect, useRef, useState } from "react";

type WizardPhase = "idle" | "running" | "question" | "done" | "error";

interface WizardStateResponse {
  phase: WizardPhase;
  remote?: string;
  message?: string;
  question?: {
    name: string;
    help: string;
    options: { value: string; label: string }[];
  };
}

const PROVIDER_LABELS = {
  onedrive: "OneDrive",
  "google-drive": "Google Drive",
} as const;

// Drives rclone's own non-interactive config wizard end to end — the only
// thing a person actually has to do is approve access in the browser
// window this opens. Everything else (picking "yes, use my browser",
// account-type defaults, etc.) is answered automatically; anything this
// wizard doesn't recognize gets surfaced as a real question instead of
// guessed at, so it degrades gracefully rather than silently misconfiguring.
export default function RcloneWizard({ onComplete }: { onComplete: (remoteName: string) => void }) {
  const [provider, setProvider] = useState<"onedrive" | "google-drive">("onedrive");
  const [remoteName, setRemoteName] = useState("onedrive");
  const [state, setState] = useState<WizardStateResponse>({ phase: "idle" });
  const [answerValue, setAnswerValue] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function poll() {
    pollRef.current = setInterval(() => {
      fetch("/api/settings/cloud-backup/rclone/wizard")
        .then((res) => res.json())
        .then((body: WizardStateResponse) => {
          setState(body);
          if (body.phase === "done" || body.phase === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
          if (body.phase === "done" && body.remote) onComplete(body.remote);
        })
        .catch(() => {
          if (pollRef.current) clearInterval(pollRef.current);
        });
    }, 2000);
  }

  async function start() {
    setState({ phase: "running" });
    await fetch("/api/settings/cloud-backup/rclone/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, remoteName }),
    })
      .then((res) => res.json())
      .then(setState);
    poll();
  }

  async function submitAnswer() {
    setSubmittingAnswer(true);
    try {
      const res = await fetch("/api/settings/cloud-backup/rclone/wizard/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: answerValue }),
      });
      setState(await res.json());
      setAnswerValue("");
      poll();
    } finally {
      setSubmittingAnswer(false);
    }
  }

  async function cancel() {
    if (pollRef.current) clearInterval(pollRef.current);
    await fetch("/api/settings/cloud-backup/rclone/wizard", { method: "DELETE" });
    setState({ phase: "idle" });
  }

  if (state.phase === "idle") {
    return (
      <div className="surface-row flex flex-col gap-2 border-accent/30 bg-accent/5">
        <p className="font-medium">Set up automatically</p>
        <p className="text-xs text-muted">
          Picks a name, opens your browser to sign in, and answers rclone&apos;s setup questions for
          you. The only thing you need to do is sign in and click Accept when Microsoft/Google asks.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={provider}
            onChange={(e) => {
              const p = e.target.value as "onedrive" | "google-drive";
              setProvider(p);
              setRemoteName(p === "onedrive" ? "onedrive" : "googledrive");
            }}
            className="surface-input"
          >
            <option value="onedrive">OneDrive</option>
            <option value="google-drive">Google Drive</option>
          </select>
          <input
            value={remoteName}
            onChange={(e) => setRemoteName(e.target.value)}
            placeholder="Remote name"
            className="surface-input flex-1"
          />
          <button onClick={start} disabled={!remoteName.trim()} className="btn-primary px-3 py-2 text-xs">
            Start
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-row flex flex-col gap-2 border-accent/30 bg-accent/5">
      <p className="font-medium">Setting up {PROVIDER_LABELS[provider]}…</p>

      {state.phase === "running" && (
        <p className="text-muted">
          A browser window should be opening now — sign in and approve access there. This waits for
          up to 5 minutes.
        </p>
      )}

      {state.phase === "question" && state.question && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted whitespace-pre-wrap">{state.question.help}</p>
          {state.question.options.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {state.question.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setAnswerValue(opt.value);
                    submitAnswer();
                  }}
                  disabled={submittingAnswer}
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={answerValue}
                onChange={(e) => setAnswerValue(e.target.value)}
                className="surface-input flex-1"
              />
              <button onClick={submitAnswer} disabled={submittingAnswer} className="btn-primary px-3 py-1.5 text-xs">
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {state.phase === "done" && (
        <p className="text-emerald-600">Connected — remote &quot;{state.remote}&quot; is ready below.</p>
      )}

      {state.phase === "error" && <p className="text-red-600">Failed: {state.message}</p>}

      {(state.phase === "error" || state.phase === "question" || state.phase === "running") && (
        <button onClick={cancel} className="btn-secondary self-start px-3 py-1.5 text-xs">
          Cancel
        </button>
      )}
    </div>
  );
}
