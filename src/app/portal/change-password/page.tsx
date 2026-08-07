import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getClientSessionUser } from "@/lib/clientAuth";
import PortalChangePasswordForm from "@/components/PortalChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function PortalChangePasswordPage() {
  const token = (await cookies()).get("client_session")?.value;
  const user = await getClientSessionUser(token);
  if (!user) redirect("/portal/login");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm tracking-wide text-muted uppercase">Client Portal</p>
        <h1 className="font-display text-3xl italic">Set your password</h1>
      </div>
      <PortalChangePasswordForm forced={Boolean(user.mustChangePassword)} />
    </main>
  );
}
