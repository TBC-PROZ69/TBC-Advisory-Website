import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { PageHero } from "@/components/page-hero";
import { ProfessionalServiceJsonLd } from "@/components/professional-service-json-ld";
import { formatInsightDate, getInsights, insightHref } from "@/lib/insights";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Insights",
  description:
    "Counsel for HOA and COA boards on fees, budgets, vendors, reserves, and what remains after a structural study. Notes from TBC Advisory — not a management company.",
  path: "/insights",
});

export default function InsightsPage() {
  const posts = getInsights();

  return (
    <>
      <ProfessionalServiceJsonLd />
      <PageHero eyebrow="For directors and officers" title="Insights" />

      <section>
        <Container className="max-w-3xl py-16 sm:py-20">
          <ul className="space-y-6">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={insightHref(post.slug)}
                  className="group block rounded-md border border-navy/10 bg-card p-7 transition-colors hover:border-primary/40"
                >
                  <time
                    dateTime={post.date}
                    className="text-sm text-brass"
                  >
                    {formatInsightDate(post.date)}
                  </time>
                  <h2 className="font-heading mt-2 text-2xl tracking-tight text-navy group-hover:text-primary">
                    {post.title}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-navy/70">
                    {post.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
