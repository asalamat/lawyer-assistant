import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { getAppVersion } from "@/lib/systemInfo";
import ConditionalFooter from "@/components/ConditionalFooter";
import ConditionalNav from "@/components/ConditionalNav";
import ThemeScript from "@/components/ThemeScript";
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
        <ConditionalNav />
        <div className="flex min-w-0 flex-1 flex-col">
          {children}
          <ConditionalFooter version={version} />
        </div>
      </body>
    </html>
  );
}
