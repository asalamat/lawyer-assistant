"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HealthStatus } from "@/lib/health";

export default function HealthIndicator() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!status) return null;

  const dotColor = status.overall === "ok" ? "bg-green-500" : "bg-red-500";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 text-sm text-foreground/80 hover:text-accent"
        aria-label="System health"
        title={status.overall === "ok" ? "All core systems configured" : "No AI provider configured"}
      >
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-border bg-card p-3 text-sm shadow-lg">
          <p className="mb-2 font-medium">System health</p>
          <ul className="flex flex-col gap-1.5">
            {status.checks.map((check) => (
              <li key={check.name} className="flex items-start gap-2">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    check.configured ? "bg-green-500" : "bg-muted"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <Link href={check.settingsHref} className="hover:text-accent">
                    {check.name}
                  </Link>
                  <p className="text-xs text-muted">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
