import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSessionUser } from "@/lib/clientAuth";
import { getClient, listMattersForClient } from "@/lib/clients";
import PortalLogoutButton from "@/components/PortalLogoutButton";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const token = (await cookies()).get("client_session")?.value;
  const user = await getClientSessionUser(token);
  if (!user) redirect("/portal/login");
  if (user.mustChangePassword) redirect("/portal/change-password");

  const client = await getClient(user.clientId);
  const matters = await listMattersForClient(user.clientId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm tracking-wide text-muted uppercase">Client Portal</p>
          <h1 className="font-display text-3xl italic">{client?.name ?? "Welcome"}</h1>
        </div>
        <PortalLogoutButton />
      </div>

      <div>
        <h2 className="mb-2 font-display text-lg">Your matters</h2>
        {matters.length === 0 ? (
          <p className="text-sm text-muted">No matters yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {matters.map((matter) => (
              <li key={matter.id}>
                <Link href={`/portal/matters/${matter.id}`} className="surface-row block text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                  <span className="font-medium">{matter.title}</span>
                  <span className="ml-2 badge">{matter.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
