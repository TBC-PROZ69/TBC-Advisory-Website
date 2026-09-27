import type { Metadata } from "next";

import { Container } from "@/components/container";
import { CtaLink } from "@/components/cta-link";
import { notFoundMetadata } from "@/lib/seo";

export const metadata: Metadata = notFoundMetadata();

export default function NotFound() {
  return (
    <section className="bg-primary text-white">
      <Container className="py-24 sm:py-32">
        <p className="text-[0.7rem] font-medium tracking-[0.22em] text-white/80 uppercase">
          404
        </p>
        <h1 className="font-heading mt-4 max-w-xl text-4xl tracking-tight">
          That page is not on this site
        </h1>
        <p className="mt-4 max-w-lg text-base text-white/85">
          The address may be leftover from the previous site. Start from the
          home page, or write us if you were looking for something specific.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <CtaLink href="/" variant="cream">
            Back to home
          </CtaLink>
          <CtaLink
            href="/contact"
            variant="outline"
            className="border-white/50 text-white hover:bg-white/10 hover:text-white"
          >
            Contact
          </CtaLink>
        </div>
      </Container>
    </section>
  );
}
