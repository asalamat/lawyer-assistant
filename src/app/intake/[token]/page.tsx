import ClientIntakeForm from "@/components/ClientIntakeForm";

// Standalone client-facing page: no login, and no app chrome (see
// isChromelessRoute in src/lib/chromelessRoutes.ts) — the person filling this
// in is a client, not staff, and should see a form rather than the firm's
// matter-management UI.
export const dynamic = "force-dynamic";

export default async function ClientIntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-sm tracking-wide text-muted uppercase">Client intake</p>
        <h1 className="font-display text-3xl italic">Tell us about your matter</h1>
      </div>
      <ClientIntakeForm token={token} />
    </main>
  );
}
