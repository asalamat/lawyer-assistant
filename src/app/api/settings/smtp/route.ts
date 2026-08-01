import { NextResponse } from "next/server";
import { getSmtpStatus, setSmtpConfig } from "@/lib/settings";

export async function GET() {
  const status = await getSmtpStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { host, port, secure, username, password, fromName, fromEmail } = body ?? {};

  if (typeof host !== "string" || !host.trim()) {
    return NextResponse.json({ error: "host is required" }, { status: 400 });
  }
  const parsedPort = Number(port);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
    return NextResponse.json({ error: "port must be a valid port number" }, { status: 400 });
  }
  if (typeof username !== "string" || !username.trim()) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "password is required" }, { status: 400 });
  }
  if (typeof fromEmail !== "string" || !fromEmail.includes("@")) {
    return NextResponse.json({ error: "fromEmail must be a valid email address" }, { status: 400 });
  }

  await setSmtpConfig({
    host: host.trim(),
    port: parsedPort,
    secure: Boolean(secure),
    username: username.trim(),
    password,
    fromName: typeof fromName === "string" ? fromName.trim() : "",
    fromEmail: fromEmail.trim(),
  });

  const status = await getSmtpStatus();
  return NextResponse.json(status);
}
