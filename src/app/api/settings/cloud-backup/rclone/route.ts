import { NextResponse } from "next/server";
import { listRcloneRemotes } from "@/lib/rcloneBackup";
import { getCloudBackupStatus, setRcloneBackupConfig } from "@/lib/settings";

// Lists remotes already configured via `rclone config` on this machine —
// lets the UI offer a dropdown instead of asking someone to type an exact
// remote name from memory. Empty array (not an error) if rclone isn't
// installed yet.
export async function GET() {
  const remotes = await listRcloneRemotes();
  return NextResponse.json({ remotes });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { remote, path, binaryPath } = body ?? {};

  if (typeof remote !== "string" || !remote.trim()) {
    return NextResponse.json({ error: "remote is required" }, { status: 400 });
  }

  await setRcloneBackupConfig({
    remote: remote.trim(),
    path: typeof path === "string" ? path.trim() : undefined,
    binaryPath: typeof binaryPath === "string" ? binaryPath.trim() : undefined,
  });

  return NextResponse.json(await getCloudBackupStatus());
}
