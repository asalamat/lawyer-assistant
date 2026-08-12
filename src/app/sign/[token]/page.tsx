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
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <SignDocumentForm fetchUrl={`/api/sign/${token}`} submitUrl={`/api/sign/${token}`} />
    </main>
  );
}
