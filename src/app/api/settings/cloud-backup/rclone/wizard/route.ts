import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWizardState, resetWizard, startWizard, type RcloneWizardProvider } from "@/lib/rcloneWizard";

const WIZARD_PROVIDERS: RcloneWizardProvider[] = ["onedrive", "google-drive"];

export async function GET() {
  return NextResponse.json(getWizardState());
}

// Runs real shell commands (rclone config create/update) and, for the
// browser-auth step, opens a real browser window on this machine — same
// sensitivity tier as the rclone install endpoint, so this gets the same
// explicit admin re-check on top of proxy.ts's blanket /api/settings gate.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { provider, remoteName } = body ?? {};

  if (!WIZARD_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "provider must be onedrive or google-drive" }, { status: 400 });
  }
  if (typeof remoteName !== "string" || !/^[A-Za-z0-9_-]+$/.test(remoteName)) {
    return NextResponse.json(
      { error: "remoteName is required and can only contain letters, numbers, - and _" },
      { status: 400 },
    );
  }

  startWizard(provider, remoteName);
  return NextResponse.json(getWizardState());
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  resetWizard();
  return NextResponse.json(getWizardState());
}
