import { getCurrentUser } from "@/lib/auth";
import { AI_PROVIDER_LABELS, getAiProviderOrder, getIndependentReviewProviderOrder } from "@/lib/settings";
import SameProviderWarningBar from "@/components/SameProviderWarningBar";

// A template, not part of layout.tsx — layouts persist across client-side
// navigations (Next.js reuses the rendered layout instance rather than
// re-running it on every <Link> click), so a check computed there goes
// stale the moment you save a settings change and navigate elsewhere
// without a full page reload. Templates remount on every navigation,
// guaranteeing this re-fetches the current provider order each time.
export default async function RootTemplate({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Only an admin can act on this (Settings > AI model is admin-gated), so
  // showing it to everyone else would just point at a page they can't reach.
  let sameProviderLabel: string | null = null;
  if (user?.role === "admin") {
    const [primaryOrder, independentOrder] = await Promise.all([
      getAiProviderOrder(),
      getIndependentReviewProviderOrder(),
    ]);
    // Enabled as primary at all, not just the top of its fallback sequence
    // — still not an independent second opinion once primary fails over to
    // it, so this checks the whole enabled set rather than just position 0.
    if ((primaryOrder as string[]).includes(independentOrder[0])) {
      sameProviderLabel = AI_PROVIDER_LABELS[independentOrder[0]] ?? independentOrder[0];
    }
  }

  return (
    <>
      <SameProviderWarningBar providerLabel={sameProviderLabel} />
      {children}
    </>
  );
}
