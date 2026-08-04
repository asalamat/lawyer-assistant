"use client";

import { usePathname } from "next/navigation";
import { isChromelessRoute } from "@/lib/chromelessRoutes";
import ThemeToggle from "./ThemeToggle";
import WeatherDisplay from "./WeatherDisplay";

export default function TopUtilityBar() {
  const pathname = usePathname();
  if (isChromelessRoute(pathname)) return null;

  return (
    <div className="flex items-center justify-end gap-4 border-b border-border bg-card/60 px-6 py-3 backdrop-blur">
      <WeatherDisplay />
      <ThemeToggle />
    </div>
  );
}
