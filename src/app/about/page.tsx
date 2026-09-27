import type { Metadata } from "next";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { ProfessionalServiceJsonLd } from "@/components/professional-service-json-ld";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "About",
  description:
    "TBC Advisory was established by its Founder & CEO after serving as an elected Director on the board of a $100 million-plus residential condominium community.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <ProfessionalServiceJsonLd />
      <PageHero eyebrow="About TBC Advisory" title="Why this firm exists">
        <p>
          An independent consultancy, started by a board member who had seen
          enough of the usual arrangement.
        </p>
      </PageHero>

      <section>
        <Container className="max-w-3xl py-16 sm:py-20">
          <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
            Founder &amp; CEO
          </p>
          <h2 className="font-heading mt-3 text-3xl tracking-tight text-navy">
            Started from a board seat, not a management desk
          </h2>
          <div className="mt-6 space-y-5 text-base leading-relaxed text-navy/80">
            <p>
              The Founder &amp; CEO of TBC Advisory served as an elected
              Director on the board of a residential condominium community
              valued at more than $100 million. That is the seat the firm was
              built from—not a management office.
            </p>
            <p>
              The committee work was specific. He chaired Landscape, Dock, and
              IT—Dock being the board committee for that condominium
              amenity—and served as a member of the Architectural Review Board,
              Finance, and Maintenance committees.
            </p>
            <dl className="grid gap-6 border-y border-navy/10 py-6 sm:grid-cols-2">
              <div>
                <dt className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
                  Committee chairman
                </dt>
                <dd className="mt-2 text-navy">Landscape · Dock · IT</dd>
              </div>
              <div>
                <dt className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
                  Committee member
                </dt>
                <dd className="mt-2 text-navy">
                  Architectural Review Board · Finance · Maintenance
                </dd>
              </div>
            </dl>
            <p>
              On that board he saw, firsthand, what too many directors already
              know. Property management companies lacked urgency. Vendor and
              project management was poor. Communication was ineffective. Best
              in class service was treated as optional—while the fees were not.
            </p>
            <p>
              That frustration became the brief. He set out to understand how
              the property management industry actually works, and to give HOA
              and COA boards the tools, expertise, and support to take back
              control of their communities.
            </p>
            <p>
              TBC Advisory is the result: an independent consultancy. We write
              operational roadmaps tailored to the community. We work toward
              long-term success, sustainability, and fiscal responsibility. We
              help boards reduce over-reliance on traditional property
              management companies. We do not sell overnight replacement of a
              manager, and we do not pretend one engagement fits every
              association.
            </p>
          </div>
        </Container>
      </section>

      <section className="border-t border-navy/10 bg-card">
        <Container className="max-w-3xl py-16 sm:py-20">
          <h2 className="font-heading text-3xl tracking-tight text-navy">
            What we will not claim
          </h2>
          <ul className="mt-6 space-y-3 text-base leading-relaxed text-navy/75">
            <li>
              We are not a property management company, and we do not staff your
              property around the clock.
            </li>
            <li>
              We do not publish a partner roster or a set of results we cannot
              show.
            </li>
            <li>
              We do not promise that a single engagement will replace the firm
              already on contract.
            </li>
          </ul>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
