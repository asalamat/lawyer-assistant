import Link from "next/link";
import { formatBytes, formatUptime, getMonitoringSnapshot } from "@/lib/monitoring";
import { GaugeCard, StackedBar, type GaugeStatus } from "@/components/Gauge";
import RefreshButton from "@/components/RefreshButton";

export const dynamic = "force-dynamic";

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card flex flex-col gap-2">
      <h2 className="font-display text-lg">{title}</h2>
      {children}
    </div>
  );
}

function backupFreshness(ageDays: number | null): { percent: number; status: GaugeStatus; value: string; sublabel: string } {
  if (ageDays === null) return { percent: 0, status: "bad", value: "None", sublabel: "No backups yet" };
  const percent = Math.max(0, 100 - (ageDays / 14) * 100);
  const status: GaugeStatus = ageDays <= 2 ? "good" : ageDays <= 10 ? "warn" : "bad";
  const value = ageDays < 1 ? "<1d" : `${Math.floor(ageDays)}d`;
  return { percent, status, value, sublabel: "since last backup" };
}

export default async function MonitoringPage() {
  const snapshot = await getMonitoringSnapshot();
  const { appVersion, auditIntegrity, counts, storage, backups, health, latestBackupAgeDays } = snapshot;
  const totalBackupBytes = backups.reduce((sum, b) => sum + b.sizeBytes, 0);

  const configuredCount = health.checks.filter((c) => c.configured).length;
  const totalChecks = health.checks.length;
  const setupStatus: GaugeStatus = health.overall === "ok" ? (configuredCount === totalChecks ? "good" : "warn") : "bad";
  const encryptionStatus: GaugeStatus =
    storage.masterKeyStorage === "keychain" ? "good" : storage.masterKeyStorage === "file" ? "warn" : "bad";
  const backupGauge = backupFreshness(latestBackupAgeDays);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl italic">System status</h1>
          <p className="mt-1 text-sm text-muted">
            A live snapshot of this installation — nothing here is cached; every load re-reads the
            database and filesystem. Admin-only.
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <GaugeCard
          label="Data integrity"
          value={auditIntegrity.valid ? "OK" : "Broken"}
          percent={auditIntegrity.valid ? 100 : 0}
          status={auditIntegrity.valid ? "good" : "bad"}
          sublabel={`${auditIntegrity.checkedCount} audit entries`}
        />
        <GaugeCard
          label="Setup complete"
          value={`${configuredCount}/${totalChecks}`}
          percent={(configuredCount / totalChecks) * 100}
          status={setupStatus}
          sublabel="integrations configured"
        />
        <GaugeCard
          label="Encryption key"
          value={
            storage.masterKeyStorage === "keychain"
              ? "Keychain"
              : storage.masterKeyStorage === "file"
                ? "File"
                : "None"
          }
          percent={storage.masterKeyStorage === "none" ? 0 : 100}
          status={encryptionStatus}
          sublabel="secrets & documents"
        />
        <GaugeCard
          label="Backup age"
          value={backupGauge.value}
          percent={backupGauge.percent}
          status={backupGauge.status}
          sublabel={backupGauge.sublabel}
        />
      </div>

      <Section title="Application">
        <StatRow label="Version" value={appVersion.appVersion} />
        {appVersion.gitCommit && (
          <StatRow
            label="Git commit"
            value={`${appVersion.gitCommit.shortSha} — ${appVersion.gitCommit.message}`}
          />
        )}
        <StatRow label="Uptime (this process)" value={formatUptime(snapshot.uptimeSeconds)} />
        <StatRow label="Node.js" value={snapshot.nodeVersion} />
        <StatRow label="Platform" value={snapshot.platform} />
      </Section>

      <Section title="Database">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          <StatRow label="Matters" value={counts.matters} />
          <StatRow label="Documents" value={counts.documents} />
          <StatRow label="Clients" value={counts.clients} />
          <StatRow label="Active users" value={counts.users} />
          <StatRow label="Active sessions" value={counts.activeSessions} />
          <StatRow label="Drafts" value={counts.drafts} />
          <StatRow label="Chat messages" value={counts.chatMessages} />
          <StatRow label="Audit log rows" value={counts.auditLogRows} />
          <StatRow label="Agent runs" value={counts.agentRuns} />
          <StatRow label="Document chunks" value={counts.documentChunks} />
          <StatRow label="Leads" value={counts.leads} />
          <StatRow label="Trust accounts" value={counts.trustAccounts} />
          <StatRow label="Trust transactions" value={counts.trustTransactions} />
          <StatRow label="Portal messages" value={counts.portalMessages} />
          <StatRow label="Document templates" value={counts.documentTemplates} />
          <StatRow label="Assembled documents" value={counts.assembledDocuments} />
          <StatRow label="Deadline rules" value={counts.deadlineRules} />
        </div>
      </Section>

      <Section title="Storage on disk">
        <StackedBar
          segments={[
            { label: `Database (${formatBytes(storage.databaseBytes)})`, bytes: storage.databaseBytes, colorClass: "bg-accent" },
            { label: `Documents (${formatBytes(storage.uploadsBytes)})`, bytes: storage.uploadsBytes, colorClass: "bg-amber-500" },
            { label: `Backups (${formatBytes(storage.backupsBytes)})`, bytes: storage.backupsBytes, colorClass: "bg-emerald-500" },
          ]}
        />
        <StatRow
          label="Total"
          value={formatBytes(storage.databaseBytes + storage.uploadsBytes + storage.backupsBytes)}
        />
      </Section>

      <Section title="Backups">
        <StatRow label="Backups kept" value={backups.length} />
        <StatRow label="Total size" value={formatBytes(totalBackupBytes)} />
        <StatRow
          label="Most recent"
          value={backups[0] ? new Date(backups[0].createdAt).toLocaleString() : "None yet"}
        />
        <p className="text-sm text-muted">
          Manage backups, restore, or set up scheduled backups in{" "}
          <Link href="/settings/backup" className="text-accent hover:underline">
            Settings &gt; Backup
          </Link>
          .
        </p>
      </Section>

      <Section title="Integrations">
        <ul className="flex flex-col gap-1.5">
          {health.checks.map((check) => (
            <li key={check.name} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                  check.configured ? "bg-green-500" : "bg-muted"
                }`}
              />
              <div className="min-w-0 flex-1">
                <Link href={check.settingsHref} className="hover:text-accent">
                  {check.name}
                </Link>
                <p className="text-xs text-muted">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
