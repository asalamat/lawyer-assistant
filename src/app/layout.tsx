import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { getAppVersion } from "@/lib/systemInfo";
import ConditionalNav from "@/components/ConditionalNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lawyer Assistant",
  },
};

export const viewport: Viewport = {
  themeColor: "#7a2e37",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const version = await getAppVersion();
  const user = await getCurrentUser();

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
          {children}
        </div>
        <StickyNotesWidget />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
