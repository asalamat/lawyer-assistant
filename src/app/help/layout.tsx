export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-accent">Reference guide</p>
        <h1 className="mt-1 font-display text-3xl italic">Every part of the app, explained</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          What this app can do today, organized the same way as its own navigation. Updated as
          features are added — if something you use isn&apos;t listed here, it&apos;s a
          documentation gap, not a hidden feature. Use the filter box to jump straight to a topic.
        </p>
      </div>
      {children}
    </main>
  );
}
