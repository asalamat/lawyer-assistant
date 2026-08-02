"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import type { AppVersion } from "@/lib/systemInfo";

export default function ConditionalFooter({ version }: { version: AppVersion }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return <Footer version={version} />;
}
