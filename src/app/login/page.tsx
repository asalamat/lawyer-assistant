import { hasAnyUsers } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const anyUsers = await hasAnyUsers();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm tracking-wide text-muted uppercase">Lawyer Assistant</p>
        <h1 className="font-display text-3xl italic">
          {anyUsers ? "Welcome back" : "Create the first admin account"}
        </h1>
      </div>
      <LoginForm mode={anyUsers ? "login" : "create"} />
    </main>
  );
}
