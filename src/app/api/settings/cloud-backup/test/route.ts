import { NextResponse } from "next/server";
import { testCloudBackupConnection } from "@/lib/cloudBackup";
import { getCloudBackupConfig } from "@/lib/settings";

export async function GET() {
  const config = await getCloudBackupConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "Save cloud backup settings first" },
      { status: 400 },
    );
  }
  try {
    await testCloudBackupConnection(config);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
