"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isChromelessRoute } from "@/lib/chromelessRoutes";

export default function SameProviderWarningBar({ providerLabel }: { providerLabel: string | null }) {
  const pathname = usePathname();
  if (!providerLabel || isChromelessRoute(pathname)) return null;

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/10 px-6 py-2 text-sm text-amber-800 dark:text-amber-300">
      <strong>Independent review isn&apos;t independent right now.</strong> Your primary AI provider
      and independent review provider are both {providerLabel} — a review from the same model
      family can share the same blind spots it&apos;s meant to catch.{" "}
      <Link href="/settings/ai" className="underline">
        Fix in Settings &gt; AI model
      </Link>
      .
    </div>
  );
}
