import type { Metadata } from "next";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { ProfessionalServiceJsonLd } from "@/components/professional-service-json-ld";
import { publicPageMetadata } from "@/lib/seo";
import { engagementSteps } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  title: "How we work",
  description:
    "TBC Advisory works in four steps: discovery, assessment, an operational roadmap, and implementation support. Advisory—not 24/7 on-site management.",
  path: "/how-we-work",
});

export default function HowWeWorkPage() {
  return (
    <>
      <ProfessionalServiceJsonLd />
      <PageHero eyebrow="The engagement" title="How we work with a board">
        <p>
          Advisory, not 24/7 on-site management. Four steps, scoped to the
          community in front of us—not a packaged playbook sold to every
          association on the coast.
        </p>
      </PageHero>

      <section>
        <Container className="py-16 sm:py-20">
          <ol className="space-y-12">
            {engagementSteps.map((step) => (
              <li
                key={step.number}
                className="grid gap-4 border-t border-navy/10 pt-12 first:border-t-0 first:pt-0 lg:grid-cols-[8rem_1fr]"
              >
                <p className="text-[0.75rem] tracking-[0.18em] text-brass uppercase">
                  Step {step.number}
                </p>
                <div>
                  <h2 className="font-heading text-3xl tracking-tight text-navy">
                    {step.title}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-relaxed text-navy/75">
                    {step.summary}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="border-t border-navy/10 bg-card">
        <Container className="grid gap-10 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-3xl tracking-tight text-navy">
              What this engagement is
            </h2>
            <p className="mt-4 text-base leading-relaxed text-navy/75">
              Counsel for directors who still have a management company—or who
              are deciding how much of one they actually need. We help the board
              see the operation clearly, write the roadmap, and stay close while
              the work is put in motion.
            </p>
          </div>
          <div>
            <h2 className="font-heading text-3xl tracking-tight text-navy">
              What this engagement is not
            </h2>
            <p className="mt-4 text-base leading-relaxed text-navy/75">
              We do not take over the gate, the phones, or the work-order desk.
              Your community still needs people on the ground. We help the board
              govern that work with more urgency and less waste. We do not
              replace a management company overnight.
            </p>
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
