import nodemailer from "nodemailer";
import { getSmtpConfig } from "./settings";

export async function isEmailConfigured(): Promise<boolean> {
  return Boolean(await getSmtpConfig());
}

async function getTransport() {
  const config = await getSmtpConfig();
  if (!config) {
    throw new Error("SMTP is not configured. Add your mail server details in Settings > Email.");
  }
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: config.password },
  });
  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;
  return { transport, from };
}

export async function sendEmail(message: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const { transport, from } = await getTransport();
  await transport.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

// Verifies the SMTP credentials by opening a connection and authenticating,
// without sending a message. Throws on failure with the server's message.
export async function verifyEmailConnection(): Promise<void> {
  const { transport } = await getTransport();
  await transport.verify();
}
