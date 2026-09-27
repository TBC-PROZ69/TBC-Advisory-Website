import type { Metadata } from "next";

import { Container } from "@/components/container";
import { CtaLink } from "@/components/cta-link";
import { notFoundMetadata } from "@/lib/seo";

export const metadata: Metadata = notFoundMetadata();

export default function NotFound() {
  return (
    <section className="bg-navy text-cream">
      <Container className="py-24 sm:py-32">
        <p className="text-[0.7rem] font-medium tracking-[0.22em] text-brass uppercase">
          404
        </p>
        <h1 className="font-heading mt-4 max-w-xl text-4xl tracking-tight">
          That page is not on this site
        </h1>
        <p className="mt-4 max-w-lg text-base text-cream/70">
          The address may be leftover from the previous site. Start from the
          home page, or write us if you were looking for something specific.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <CtaLink href="/" variant="brass">
            Back to home
          </CtaLink>
          <CtaLink
            href="/contact"
            variant="outline"
            className="border-cream/40 text-cream hover:bg-white/5 hover:text-cream"
          >
            Contact
          </CtaLink>
        </div>
      </Container>
    </section>
  );
}
