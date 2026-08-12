"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SignableDocumentView {
  title: string;
  kind: string;
  kindLabel: string;
  status: string;
  clientName: string | null;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 180;

// fetchUrl/submitUrl rather than a hardcoded token — this is reused as-is
// by the public, unauthenticated /sign/[token] page AND by the logged-in
// client portal (see PortalSignableDocumentsPanel.tsx), which authorizes
// via the portal session instead of a token and hits a different route.
export default function SignDocumentForm({
  fetchUrl,
  submitUrl,
  onSigned,
}: {
  fetchUrl: string;
  submitUrl: string;
  onSigned?: () => void;
}) {
  const [doc, setDoc] = useState<SignableDocumentView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [intent, setIntent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(fetchUrl);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(body.error ?? "This signing link is no longer valid.");
        } else {
          setDoc(body);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Couldn't load this document. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchUrl]);

  // Drawn onto a white fill rather than transparency, so the exported PNG
  // stays legible wherever it's later displayed or printed.
  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasDrawn(false);
  }, []);

  useEffect(() => {
    if (doc?.status === "sent") resetCanvas();
  }, [doc?.status, resetCanvas]);

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = canvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function extendStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = canvasPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }

  function endStroke() {
    drawingRef.current = false;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName,
          signerEmail: signerEmail.trim() || null,
          signatureText: signerName,
          signatureImage: hasDrawn ? (canvasRef.current?.toDataURL("image/png") ?? null) : null,
          intent,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to record your signature");
      setSignedAt(body.signedAt);
      onSigned?.();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      {loading && <p className="text-sm text-muted">Loading document…</p>}

      {!loading && loadError && (
        <div className="surface-card flex flex-col gap-2">
          <h1 className="font-display text-2xl italic">Link unavailable</h1>
          <p className="text-sm text-muted">{loadError}</p>
        </div>
      )}

      {!loading && doc && (
        <div className="surface-card flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">{doc.kindLabel}</p>
            <h1 className="font-display text-2xl italic">{doc.title}</h1>
            {doc.clientName && (
              <p className="text-sm text-muted">Prepared for {doc.clientName}</p>
            )}
          </div>

          {signedAt ? (
            <p className="text-sm">
              Thank you — your signature was recorded on {new Date(signedAt).toLocaleString()}.
              You can close this page; it&apos;s now on file with your lawyer.
            </p>
          ) : doc.status === "signed" ? (
            <p className="text-sm text-muted">
              This document has already been signed. Nothing further is needed from you.
            </p>
          ) : doc.status !== "sent" ? (
            <p className="text-sm text-muted">
              This document isn&apos;t open for signature right now. Contact your lawyer if you
              were expecting to sign it.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm">
                Your full legal name
                <input
                  required
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="e.g. Jane Alexandra Doe"
                  className="surface-input"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                Email address <span className="text-xs text-muted">(optional)</span>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="surface-input"
                />
              </label>

              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    Draw your signature <span className="text-xs text-muted">(optional)</span>
                  </span>
                  <button
                    type="button"
                    onClick={resetCanvas}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  onPointerDown={startStroke}
                  onPointerMove={extendStroke}
                  onPointerUp={endStroke}
                  onPointerLeave={endStroke}
                  className="w-full touch-none rounded-lg border border-border bg-white"
                />
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={intent}
                  onChange={(e) => setIntent(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I intend this as my legal signature, and I agree it has the same effect as
                  signing on paper.
                </span>
              </label>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              <button
                type="submit"
                disabled={submitting || !intent || !signerName.trim()}
                className="btn-primary self-start"
              >
                {submitting ? "Signing…" : "Sign document"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
