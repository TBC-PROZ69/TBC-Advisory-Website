"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { CtaLink } from "@/components/cta-link";
import { Container } from "@/components/container";
import { Wordmark } from "@/components/wordmark";
import { nav } from "@/lib/site";
import { cn } from "@/lib/utils";

function closeMobileNav() {
  const toggle = document.getElementById("mobile-nav-toggle");
  if (toggle instanceof HTMLInputElement) toggle.checked = false;
}

function navItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white text-foreground">
      <input
        id="mobile-nav-toggle"
        type="checkbox"
        className="peer sr-only"
        aria-controls="mobile-nav"
      />
      <Container className="relative z-10 flex h-20 items-center justify-between gap-4 sm:h-24">
        <Link
          href="/"
          aria-label="TBC Advisory home"
          className="shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Wordmark className="h-16 sm:h-20" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-5 lg:flex xl:gap-7">
          {nav.map((item) => {
            const active = navItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-[0.82rem] tracking-[0.04em] whitespace-nowrap transition-colors hover:text-primary",
                  active ? "text-primary" : "text-foreground/80",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <CtaLink href="/contact" variant="brass" className="h-9 px-4 text-sm">
            Free consultation
          </CtaLink>
        </div>

        <label
          htmlFor="mobile-nav-toggle"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-primary/5 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
          <span className="sr-only">Open menu</span>
        </label>
      </Container>

      <div
        id="mobile-nav"
        className="fixed inset-0 z-50 hidden peer-checked:flex lg:hidden"
      >
        <label
          htmlFor="mobile-nav-toggle"
          className="absolute inset-0 bg-ink/55"
          aria-label="Close menu"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-nav-title"
          className="relative ml-auto flex h-full w-[min(20rem,88vw)] flex-col border-l border-border bg-white text-foreground shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <p id="mobile-nav-title" className="font-heading text-lg text-foreground">
                TBC Advisory
              </p>
              <p className="mt-1 text-sm text-primary">
                Independent Partner to HOA & COA Boards
              </p>
            </div>
            <label
              htmlFor="mobile-nav-toggle"
              className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-primary/5"
            >
              <X className="size-5" />
              <span className="sr-only">Close menu</span>
            </label>
          </div>
          <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Mobile">
            <Link
              href="/"
              onClick={closeMobileNav}
              className={cn(
                "rounded-md px-3 py-3 text-base",
                pathname === "/"
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/80",
              )}
            >
              Home
            </Link>
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileNav}
                className={cn(
                  "rounded-md px-3 py-3 text-base",
                  navItemActive(pathname, item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto p-5">
            <CtaLink
              href="/contact"
              variant="brass"
              className="w-full"
              onClick={closeMobileNav}
            >
              Request a free consultation
            </CtaLink>
          </div>
        </div>
      </div>
    </header>
  );
}
