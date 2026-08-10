import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getInstallPlan, getInstallStatus, isRcloneInstalled, startRcloneInstall } from "@/lib/rcloneInstall";

export async function GET() {
  const [installed, plan, status] = await Promise.all([
    isRcloneInstalled(),
    getInstallPlan(),
    Promise.resolve(getInstallStatus()),
  ]);
  return NextResponse.json({ installed, ...plan, status });
}

// A package install is a real system-modifying action (unlike everything
// else this settings page does), so this gets the same explicit admin
// re-check the backup download/restore routes use, on top of proxy.ts's
// blanket /api/settings admin gate.
export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const status = await startRcloneInstall();
  return NextResponse.json({ status });
}
