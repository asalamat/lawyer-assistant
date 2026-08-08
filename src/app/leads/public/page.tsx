import PublicLeadForm from "@/components/PublicLeadForm";

// Standalone, no-login page meant to be <iframe>-embedded on the firm's own
// public website — bare, no app chrome (see isChromelessRoute in
// src/lib/chromelessRoutes.ts), same "client-facing, not staff-facing"
// treatment as /intake/[token] and /sign/[token].
export const dynamic = "force-dynamic";

export default function PublicLeadFormPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl italic">Get in touch</h1>
        <p className="text-sm text-muted">Tell us a bit about what you need — we&apos;ll follow up shortly.</p>
      </div>
      <PublicLeadForm />
    </main>
  );
}
