import type { Metadata } from "next";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { ProfessionalServiceJsonLd } from "@/components/professional-service-json-ld";
import { publicPageMetadata } from "@/lib/seo";
import { boardFocus } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  title: "For boards",
  description:
    "Vendor oversight, communications, reserves, project management, and property-manager accountability—for HOA and COA boards that want counsel, not another management company.",
  path: "/for-boards",
});

export default function ForBoardsPage() {
  return (
    <>
      <ProfessionalServiceJsonLd />
      <PageHero eyebrow="For directors & officers" title="What boards ask us to take on">
        <p>
          The same gaps show up in well-run associations and in ones that feel
          stuck. We help directors close them without pretending we are the
          management company.
        </p>
      </PageHero>

      <section>
        <Container className="py-16 sm:py-20">
          <div className="grid gap-6 lg:grid-cols-2">
            {boardFocus.map((item, index) => (
              <article
                key={item.title}
                className={
                  index === boardFocus.length - 1
                    ? "rounded-md border border-navy/10 bg-card p-7 lg:col-span-2"
                    : "rounded-md border border-navy/10 bg-card p-7"
                }
              >
                <p className="text-[0.7rem] tracking-[0.16em] text-brass uppercase">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="font-heading mt-2 text-2xl text-navy">
                  {item.title}
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-navy/70">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-t border-navy/10">
        <Container className="max-w-3xl py-16 sm:py-20">
          <h2 className="font-heading text-3xl tracking-tight text-navy">
            The board remains in control
          </h2>
          <p className="mt-4 text-base leading-relaxed text-navy/75">
            TBC Advisory is not a property management company. We do not insert
            ourselves between the board and its manager as a substitute staff.
            We give directors a clearer brief, a tighter hold on vendors and
            projects, and a standard they can enforce. The vote, the fiduciary
            duty, and the relationship with owners stay where they belong: with
            the board.
          </p>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
