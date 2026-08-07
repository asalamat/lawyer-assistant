import SignDocumentForm from "@/components/SignDocumentForm";

// Client-facing, no-login page reached from a signing link. Rendered without
// any of the app's staff chrome (see isChromelessRoute in
// src/lib/chromelessRoutes.ts) — the person opening this is a client, not a
// user of this app.
export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SignDocumentForm token={token} />;
}
