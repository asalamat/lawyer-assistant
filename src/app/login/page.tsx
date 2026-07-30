import { isPasswordSet } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const passwordSet = await isPasswordSet();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">
        {passwordSet ? "Log in" : "Set a password"}
      </h1>
      <LoginForm mode={passwordSet ? "login" : "create"} />
    </main>
  );
}
