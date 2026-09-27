"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Wordmark } from "@/components/wordmark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const assess = pathname.startsWith("/assess");

  if (assess) {
    return (
      <>
        <header className="border-b border-brass/30 bg-navy text-cream">
          <div className="mx-auto flex h-[4.25rem] w-full max-w-6xl items-center px-5 sm:px-8">
            <Wordmark inverted />
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-navy/10 bg-navy py-8 text-cream">
          <div className="mx-auto max-w-6xl px-5 text-xs leading-relaxed text-cream/60 sm:px-8">
            Screening tool — not legal advice, not an engineering inspection.
            TBC Advisory is not a property management company. Copyright © 2026
            TBC Advisory.
          </div>
        </footer>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
