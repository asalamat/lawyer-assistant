"use client";

import { usePathname } from "next/navigation";
import type { AppVersion } from "@/lib/systemInfo";
import AppSidebar from "./AppSidebar";

export default function ConditionalNav({ version }: { version: AppVersion }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <AppSidebar version={version} />;
}
