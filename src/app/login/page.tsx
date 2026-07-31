import { isPasswordSet } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const passwordSet = await isPasswordSet();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm tracking-wide text-muted uppercase">Lawyer Assistant</p>
        <h1 className="font-display text-3xl italic">
          {passwordSet ? "Welcome back" : "Set a password"}
        </h1>
      </div>
      <LoginForm mode={passwordSet ? "login" : "create"} />
    </main>
  );
}
