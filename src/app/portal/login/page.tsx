import PortalLoginForm from "@/components/PortalLoginForm";

export const dynamic = "force-dynamic";

export default function PortalLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm tracking-wide text-muted uppercase">Client Portal</p>
        <h1 className="font-display text-3xl italic">Welcome back</h1>
      </div>
      <PortalLoginForm />
    </main>
  );
}
