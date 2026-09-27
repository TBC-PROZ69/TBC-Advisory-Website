"use client";

import Link from "next/link";
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
        <header className="border-b border-border bg-white text-foreground">
          <div className="mx-auto flex h-20 w-full max-w-6xl items-center px-5 sm:h-24 sm:px-8">
            <Link
              href="/"
              aria-label="TBC Advisory home"
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Wordmark className="h-16 sm:h-20" />
            </Link>
          </div>
        </header>
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border bg-white py-8 text-foreground">
          <div className="mx-auto max-w-6xl px-5 text-xs leading-relaxed text-foreground/60 sm:px-8">
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
