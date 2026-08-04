"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Matter, MatterClassification } from "@/lib/types";

const CLASSIFICATION_LABELS: Record<MatterClassification, string> = {
  standard: "Standard",
  privileged: "Privileged",
  "highly-sensitive": "Highly sensitive",
};

export default function MatterComplianceControls({ matter }: { matter: Matter }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [retentionDate, setRetentionDate] = useState(matter.retentionDate?.slice(0, 10) ?? "");

  async function patch(body: Record<string, unknown>) {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "Failed to update matter");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-4">
      <h2 className="font-display text-lg">Compliance</h2>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Classification</label>
        <select
          value={matter.classification}
          disabled={updating}
          onChange={(e) => patch({ classification: e.target.value })}
          className="surface-input max-w-xs"
        >
          {Object.entries(CLASSIFICATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Retention date</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={retentionDate}
            onChange={(e) => setRetentionDate(e.target.value)}
            className="surface-input max-w-xs"
          />
          <button
            onClick={() => patch({ retentionDate: retentionDate || null })}
            disabled={updating}
            className="btn-secondary"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-muted">
          Informational only for now — nothing auto-deletes on this date.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Legal hold</label>
        {matter.legalHold ? (
          <div className="flex items-center gap-2">
            <span className="badge bg-red-600/10 text-red-700 dark:text-red-400">
              On hold{matter.legalHoldReason ? `: ${matter.legalHoldReason}` : ""}
            </span>
            <button
              onClick={() => patch({ legalHold: false })}
              disabled={updating}
              className="text-xs text-accent underline decoration-accent/40 disabled:opacity-50"
            >
              Release hold
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="Reason (optional)"
              className="surface-input max-w-xs"
            />
            <button
              onClick={() => patch({ legalHold: true, legalHoldReason: holdReason })}
              disabled={updating}
              className="text-xs text-red-600 underline decoration-red-600/40 disabled:opacity-50"
            >
              Place on hold
            </button>
          </div>
        )}
        <p className="text-xs text-muted">
          While on hold, this matter can&apos;t be deleted, even from the danger zone below.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
