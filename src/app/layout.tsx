import type { Metadata } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { site } from "@/lib/site";

import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "TBC Advisory | Independent counsel for HOA & COA boards",
    template: "%s | TBC Advisory",
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "HOA advisory",
    "COA board consulting",
    "community association consultant",
    "TBC Advisory",
  ],
  authors: [{ name: "TBC Advisory" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: site.name,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-cream focus:px-3 focus:py-2 focus:text-navy"
        >
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
