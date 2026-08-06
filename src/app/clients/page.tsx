import Link from "next/link";
import { listClients } from "@/lib/clients";
import NewClientForm from "@/components/NewClientForm";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-3xl italic">Clients</h1>
      <NewClientForm />
      {clients.length === 0 ? (
        <p className="text-sm text-muted">
          No clients yet — add one above, or one is created automatically the first time you open
          a matter for them.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="surface-card block transition-colors hover:border-accent/40"
            >
              <h3 className="font-display text-lg">{client.name}</h3>
              {client.email && <p className="mt-1 text-sm text-muted">{client.email}</p>}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
