"use client";

import { usePathname } from "next/navigation";
import AppSidebar from "./AppSidebar";

export default function ConditionalNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <AppSidebar />;
}
