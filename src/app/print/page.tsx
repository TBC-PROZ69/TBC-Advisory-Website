import type { Metadata } from "next";

import { Container } from "@/components/container";
import { PageHero } from "@/components/page-hero";
import { PrintQuoteForm } from "@/components/print-quote-form";
import { ProfessionalServiceJsonLd } from "@/components/professional-service-json-ld";
import { publicPageMetadata } from "@/lib/seo";
import { printOfferings, site } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Print",
  description:
    "TBC Print produces HOA and COA placards, property signs, wayfinding, and tradeshow or corporate 3D-printed pieces. Request a quote at info@tbcadvisory.com.",
  path: "/print",
});

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const initialStatus =
    params.sent === "1" ? "success" : params.error === "1" ? "error" : "idle";

  return (
    <>
      <ProfessionalServiceJsonLd />
      <PageHero
        eyebrow="TBC Print"
        title="Signage and print for communities and events"
      >
        <p>
          HOA and COA on-property signage, plus tradeshow and corporate
          3D-printed pieces. Quoted to the job—not a catalog of invented prices.
        </p>
      </PageHero>

      <section>
        <Container className="py-16 sm:py-20">
          <div className="grid gap-6 sm:grid-cols-2">
            {printOfferings.map((item) => (
              <article
                key={item.title}
                className="rounded-md border border-navy/10 bg-card p-7"
              >
                <h2 className="font-heading text-2xl text-navy">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-navy/70">
                  {item.body}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-10 max-w-2xl text-sm leading-relaxed text-navy/60">
            Materials, sizes, and finishes are specified with you. If you have
            artwork, send it. If you need type and layout, say so in the quote
            request.
          </p>
        </Container>
      </section>

      <section className="border-t border-navy/10 bg-card">
        <Container className="grid gap-12 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-3xl tracking-tight text-navy">
              Request a quote
            </h2>
            <p className="mt-4 text-base leading-relaxed text-navy/75">
              Describe the community or organization, what you need printed, and
              any quantities, sizes, or dates. You can also write{" "}
              <a
                href={`mailto:${site.email}`}
                className="underline underline-offset-4"
              >
                {site.email}
              </a>{" "}
              directly.
            </p>
          </div>
          <PrintQuoteForm initialStatus={initialStatus} />
        </Container>
      </section>
    </>
  );
}
