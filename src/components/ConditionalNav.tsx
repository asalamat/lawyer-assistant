"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isChromelessRoute } from "@/lib/chromelessRoutes";
import type { AppVersion } from "@/lib/systemInfo";
import AppSidebar from "./AppSidebar";

export default function ConditionalNav({
  version: initialVersion,
  user,
}: {
  version: AppVersion;
  user: { name: string; role: string } | null;
}) {
  const pathname = usePathname();
  const [version, setVersion] = useState(initialVersion);

  // layout.tsx (where `initialVersion` comes from) persists across
  // client-side navigations rather than re-running on every link click, so
  // it can go stale right after a software update — e.g. the version shown
  // here lagging behind Help's, which is a real page and always re-fetches.
  // Re-fetching on every pathname change keeps this in sync the same way.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/system/version")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setVersion(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (isChromelessRoute(pathname)) return null;
  return <AppSidebar version={version} user={user} />;
}
