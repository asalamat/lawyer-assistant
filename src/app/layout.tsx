import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { AI_PROVIDER_LABELS, getAiProviderOrder, getIndependentReviewProviderOrder } from "@/lib/settings";
import { getAppVersion } from "@/lib/systemInfo";
import ConditionalNav from "@/components/ConditionalNav";
import SameProviderWarningBar from "@/components/SameProviderWarningBar";
import StickyNotesWidget from "@/components/StickyNotesWidget";
import ThemeScript from "@/components/ThemeScript";
import TopUtilityBar from "@/components/TopUtilityBar";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono-plex",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Lawyer Assistant",
  description: "Matter management, document intake, and legal Q&A",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const version = await getAppVersion();
  const user = await getCurrentUser();

  // Only an admin can act on this (Settings > AI model is admin-gated), so
  // showing it to everyone else would just point at a page they can't reach.
  let sameProviderLabel: string | null = null;
  if (user?.role === "admin") {
    const [primaryOrder, independentOrder] = await Promise.all([
      getAiProviderOrder(),
      getIndependentReviewProviderOrder(),
    ]);
    if (primaryOrder[0] === independentOrder[0]) {
      sameProviderLabel = AI_PROVIDER_LABELS[independentOrder[0]] ?? independentOrder[0];
    }
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col sm:flex-row">
        <ConditionalNav version={version} user={user ? { name: user.name, role: user.role } : null} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopUtilityBar />
          <SameProviderWarningBar providerLabel={sameProviderLabel} />
          {children}
        </div>
        <StickyNotesWidget />
      </body>
    </html>
  );
}
