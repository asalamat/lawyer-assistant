"use client";

import { usePathname } from "next/navigation";
import { isChromelessRoute } from "@/lib/chromelessRoutes";
import type { AppVersion } from "@/lib/systemInfo";
import AppSidebar from "./AppSidebar";

export default function ConditionalNav({
  version,
  user,
}: {
  version: AppVersion;
  user: { name: string; role: string } | null;
}) {
  const pathname = usePathname();
  if (isChromelessRoute(pathname)) return null;
  return <AppSidebar version={version} user={user} />;
}
