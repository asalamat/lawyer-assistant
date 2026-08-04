"use client";

import { useRef, useState } from "react";
import { MicIcon } from "./icons";

// Records a short voice note, transcribes it via /api/transcribe (OpenAI
// Whisper — the same pipeline already used for uploaded audio/video), and
// hands the resulting text to the caller. Deliberately record-then-upload
// rather than the browser's built-in SpeechRecognition API: that API isn't
// available in Firefox and is inconsistent in Safari, while this reuses
// infrastructure that's already configured and works everywhere
// getUserMedia does.
export default function DictateButton({
  onText,
  disabled,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        void handleStop();
      };
      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
    } catch {
      setError("Couldn't access the microphone — check your browser's permission settings.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function handleStop() {
    setState("transcribing");
    try {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "dictation.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Transcription failed");
      if (body.text) onText(body.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setState("idle");
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || state === "transcribing"}
        onClick={state === "recording" ? stopRecording : startRecording}
        aria-label={state === "recording" ? "Stop recording" : "Dictate"}
        title={state === "recording" ? "Stop recording" : "Dictate this field"}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          state === "recording"
            ? "bg-red-600 text-white"
            : "text-foreground/60 hover:bg-black/[0.05] hover:text-accent dark:hover:bg-white/[0.08]"
        } disabled:opacity-50`}
      >
        {state === "transcribing" ? (
          <span className="text-xs">…</span>
        ) : (
          <MicIcon className="h-3.5 w-3.5" />
        )}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
