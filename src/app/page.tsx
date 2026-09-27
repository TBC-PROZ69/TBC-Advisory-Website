import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { CtaLink } from "@/components/cta-link";
import { ProfessionalServiceJsonLd } from "@/components/professional-service-json-ld";
import { HOME_TITLE, publicPageMetadata } from "@/lib/seo";
import { engagementSteps, site } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  title: HOME_TITLE,
  description: site.description,
  path: "/",
  absoluteTitle: true,
});

const painPoints = [
  {
    title: "Urgency that never arrives",
    body: "Routine issues linger. Capital work slips. The board hears that someone is looking into it—and then the next meeting arrives with the same item open.",
  },
  {
    title: "Vendors and projects without a grip",
    body: "Bids, scopes, and timelines drift. No one owns the outcome except the directors who already volunteered their evenings.",
  },
  {
    title: "Communication that leaves owners guessing",
    body: "Updates are late, thin, or missing. The board absorbs the frustration in the lobby, at the gate, and in the inbox.",
  },
  {
    title: "Fees that rise faster than accountability",
    body: "The invoice is clear. The service standard is not. High fees without a matching standard of care is how boards lose control.",
  },
];

export default function HomePage() {
  return (
    <>
      <ProfessionalServiceJsonLd />
      <section className="bg-primary text-white">
        <Container className="flex min-h-[calc(100svh-5rem)] flex-col justify-center py-16 sm:min-h-[calc(100svh-6rem)] sm:py-20">
          <p className="text-[0.7rem] font-medium tracking-[0.22em] text-white/80 uppercase">
            Independent consultancy · HOA & COA boards
          </p>
          <h1 className="font-heading mt-4 max-w-3xl text-4xl leading-[1.12] tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Independent counsel for HOA and COA boards
          </h1>
          <div className="mt-6 h-px w-16 bg-white" />
          <p className="mt-6 max-w-2xl text-xl leading-snug text-white sm:text-2xl">
            TBC Advisory is not a property management company.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            We work with board members who need a tailored operational
            roadmap—one that strengthens sustainability and fiscal
            responsibility, and reduces over-reliance on a traditional
            management firm.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <CtaLink href="/contact" variant="cream">
              Request a free consultation
            </CtaLink>
            <CtaLink
              href="/how-we-work"
              variant="outline"
              className="border-white/50 text-white hover:bg-white/10 hover:text-white"
            >
              How we work
            </CtaLink>
          </div>
          <p className="mt-8 text-sm text-white/80">
            Need On-property signage or a tradeshow piece?{" "}
            <Link href="/print" className="text-white underline-offset-4 hover:underline">
              See TBC Print
            </Link>
            .
          </p>
        </Container>
      </section>

      <section className="border-b border-navy/10">
        <Container className="grid gap-10 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
              What we are
            </p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight text-navy">
              A consultancy that sits with the board
            </h2>
            <p className="mt-4 text-base leading-relaxed text-navy/75">
              TBC Advisory is an independent consultancy dedicated to HOA and
              COA board members. We write operational roadmaps tailored to the
              community in front of us—not a packaged playbook, and not another
              management contract.
            </p>
          </div>
          <div>
            <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
              What we are not
            </p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight text-navy">
              Not a property management company
            </h2>
            <p className="mt-4 text-base leading-relaxed text-navy/75">
              We do not staff the gate, the phones, or the work-order desk. We
              are not 24/7 on-site management. We do not replace a management
              company overnight. The board remains the client; we remain
              counsel.
            </p>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 sm:py-20">
          <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
            Why boards call
          </p>
          <h2 className="font-heading mt-3 max-w-2xl text-3xl tracking-tight text-navy sm:text-4xl">
            The problems that keep returning to the agenda
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {painPoints.map((item, index) => (
              <article
                key={item.title}
                className="rounded-md border border-navy/10 bg-card p-6"
              >
                <p className="text-[0.7rem] tracking-[0.16em] text-brass uppercase">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="font-heading mt-2 text-xl text-navy">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-navy/70">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-primary text-white">
        <Container className="py-16 sm:py-20">
          <p className="text-[0.7rem] font-medium tracking-[0.18em] text-white/80 uppercase">
            How we work
          </p>
          <h2 className="font-heading mt-3 max-w-2xl text-3xl tracking-tight sm:text-4xl">
            Four steps. Advisory, not occupancy.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85">
            Discovery, assessment, an operational roadmap, then implementation
            support. We stay close to the work. We do not move in.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {engagementSteps.map((step) => (
              <li key={step.number}>
                <p className="text-[0.7rem] tracking-[0.16em] text-white/80 uppercase">
                  {step.number}
                </p>
                <h3 className="font-heading mt-2 text-xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/85">
                  {step.summary}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <CtaLink
              href="/how-we-work"
              variant="outline"
              className="border-white/50 text-white hover:bg-white/10 hover:text-white"
            >
              The engagement in full
            </CtaLink>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
              TBC Print
            </p>
            <h2 className="font-heading mt-3 text-3xl tracking-tight text-navy">
              On-property signage and tradeshow printing
            </h2>
            <p className="mt-4 text-base leading-relaxed text-navy/75">
              Boards also need signs people can follow. TBC Print produces
              community placards, property identification signs, wayfinding, and
              tradeshow or corporate 3D-printed pieces. Quoted to spec—no
              published price list.
            </p>
            <div className="mt-8">
              <CtaLink href="/print" variant="outline" className="border-navy/25">
                Request a print quote
              </CtaLink>
            </div>
          </div>
        </Container>
      </section>

      <CtaBand
        body={`Write ${site.email} or use the form. The first conversation is a free consultation—no obligation to engage.`}
      />
    </>
  );
}
