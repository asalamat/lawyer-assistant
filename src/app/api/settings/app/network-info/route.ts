import os from "os";
import { NextResponse } from "next/server";

// A phone scanning the QR code can't reach "localhost" — that resolves to
// the phone itself, not this machine. If the browser viewing Settings is
// on localhost/127.0.0.1, the QR code needs the machine's actual LAN IP
// instead, so a phone on the same Wi-Fi network can reach it.
export async function GET() {
  const lanIps: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) lanIps.push(addr.address);
    }
  }
  return NextResponse.json({ lanIps });
}
