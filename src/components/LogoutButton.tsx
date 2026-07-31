"use client";

import { useRouter } from "next/navigation";
import { LogoutIcon } from "./icons";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-sm text-foreground/80 transition-colors hover:text-accent"
    >
      <LogoutIcon className="h-4 w-4" />
      Log out
    </button>
  );
}
