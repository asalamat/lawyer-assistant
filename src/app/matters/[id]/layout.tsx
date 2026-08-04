import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatter } from "@/lib/matters";
import MatterStatusToggle from "@/components/MatterStatusToggle";
import MatterSidebarNav from "@/components/MatterSidebarNav";

export default async function MatterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matter = await getMatter(id);
  if (!matter) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl italic">{matter.title}</h1>
            <span className="badge font-mono">{matter.fileNumber}</span>
          </div>
          <p className="text-sm text-muted">
            {matter.clientName} &middot; {matter.matterType}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <MatterStatusToggle matter={matter} />
            {Boolean(matter.legalHold) && (
              <span
                className="badge bg-red-600/10 text-red-700 dark:text-red-400"
                title={matter.legalHoldReason ?? undefined}
              >
                Legal hold
              </span>
            )}
          </div>
        </div>
        <Link href={`/matters/${matter.id}/chat`} className="btn-primary">
          Chat about this matter
        </Link>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row">
        <MatterSidebarNav matterId={matter.id} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  );
}
