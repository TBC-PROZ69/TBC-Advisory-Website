import Link from "next/link";

import { Container } from "@/components/container";
import { Wordmark } from "@/components/wordmark";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-brass/25 bg-navy text-cream">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Wordmark inverted />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream/75">
            Independent consultancy for HOA and COA board members. Not a
            property management company.
          </p>
          <p className="mt-3 text-sm text-cream/60">{site.locationCue}</p>
        </div>

        <div>
          <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
            Contact
          </p>
          <a
            href={`mailto:${site.email}`}
            className="mt-3 block text-sm text-cream/90 underline-offset-4 hover:text-brass hover:underline"
          >
            {site.email}
          </a>
          <div className="mt-4 flex gap-4 text-sm">
            <a
              href={site.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cream/80 underline-offset-4 hover:text-brass hover:underline"
            >
              Facebook
            </a>
            <a
              href={site.x}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cream/80 underline-offset-4 hover:text-brass hover:underline"
            >
              X
            </a>
          </div>
        </div>

        <div>
          <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
            Site
          </p>
          <ul className="mt-3 space-y-2 text-sm text-cream/80">
            <li>
              <Link href="/how-we-work" className="hover:text-brass">
                How we work
              </Link>
            </li>
            <li>
              <Link href="/for-boards" className="hover:text-brass">
                For boards
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-brass">
                About
              </Link>
            </li>
            <li>
              <Link href="/print" className="hover:text-brass">
                Print
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-brass">
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-5 text-xs text-cream/50 sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright © 2026 TBC Advisory. All rights reserved.</p>
          <p>{site.locationShort}</p>
        </Container>
      </div>
    </footer>
  );
}
