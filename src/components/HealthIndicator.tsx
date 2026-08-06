"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HealthStatus } from "@/lib/health";

export default function HealthIndicator({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  const dotColor = status.overall === "ok" ? "bg-green-500" : "bg-red-500";
  const title =
    status.overall === "ok"
      ? "All core systems configured"
      : "No AI provider configured";

  // The full monitoring page is admin-only (operational/infrastructure
  // detail) — a non-admin still sees the dot as a status signal, just not
  // as a link to a page they'd be redirected away from anyway.
  if (!isAdmin) {
    return (
      <span
        className="flex items-center gap-1.5 text-sm text-foreground/80"
        aria-label="System status"
        title={title}
      >
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      </span>
    );
  }

  return (
    <Link
      href="/monitoring"
      className="flex items-center gap-1.5 text-sm text-foreground/80 hover:text-accent"
      aria-label="System status"
      title={`${title} — click for full system status`}
    >
      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
    </Link>
  );
}
