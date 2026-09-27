import type { Metadata } from "next";

import { ConsultForm } from "@/components/consult-form";
import { Container } from "@/components/container";
import { PageHero } from "@/components/page-hero";
import { ProfessionalServiceJsonLd } from "@/components/professional-service-json-ld";
import { publicPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Contact",
  description:
    "Request a free consultation with TBC Advisory. Email info@tbcadvisory.com or use the form.",
  path: "/contact",
});

export default async function ContactPage({
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
      <PageHero eyebrow="Contact" title="Request a free consultation">
        <p>
          Tell us about the community and what the board is facing. We follow up
          from {site.email}.
        </p>
      </PageHero>

      <section>
        <Container className="grid gap-12 py-16 sm:py-20 lg:grid-cols-[1fr_1.1fr]">
          <aside className="space-y-8">
            <div>
              <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
                Email
              </p>
              <a
                href={`mailto:${site.email}`}
                className="mt-2 block text-lg text-navy underline-offset-4 hover:underline"
              >
                {site.email}
              </a>
              <p className="mt-3 text-sm leading-relaxed text-navy/65">
                That address is the office. Submit the form on this page—we
                follow up from there.
              </p>
            </div>
            <div>
              <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
                Where we work
              </p>
              <p className="mt-2 text-base leading-relaxed text-navy/75">
                {site.locationCue} One practice—not a map of satellite offices.
              </p>
            </div>
            <div>
              <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
                Social
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <a
                  href={site.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-navy underline-offset-4 hover:underline"
                >
                  Facebook
                </a>
                <a
                  href={site.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-navy underline-offset-4 hover:underline"
                >
                  X
                </a>
              </div>
            </div>
          </aside>
          <div className="rounded-md border border-navy/10 bg-card p-6 sm:p-8">
            <ConsultForm initialStatus={initialStatus} />
          </div>
        </Container>
      </section>
    </>
  );
}
