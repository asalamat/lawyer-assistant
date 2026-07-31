import { NextResponse } from "next/server";
import { getOAuthCredentialStatus, listEmailAccounts } from "@/lib/emailIntegration";

export async function GET() {
  const [accounts, credentialStatus] = await Promise.all([
    listEmailAccounts(),
    getOAuthCredentialStatus(),
  ]);
  return NextResponse.json({ accounts, credentialStatus });
}
