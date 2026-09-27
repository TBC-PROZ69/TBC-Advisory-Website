import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { InsightBody } from "@/components/insight-body";
import { PageHero } from "@/components/page-hero";
import { ProfessionalServiceJsonLd } from "@/components/professional-service-json-ld";
import {
  formatInsightDate,
  getInsight,
  getInsights,
  insightHref,
} from "@/lib/insights";
import { publicPageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getInsights().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getInsight(slug);
  if (!post) {
    notFound();
  }

  return publicPageMetadata({
    title: post.title,
    description: post.description,
    path: insightHref(post.slug),
  });
}

export default async function InsightPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getInsight(slug);
  if (!post) {
    notFound();
  }

  return (
    <>
      <ProfessionalServiceJsonLd />
      <PageHero eyebrow="Insights" title={post.title}>
        <time dateTime={post.date}>{formatInsightDate(post.date)}</time>
      </PageHero>

      <article>
        <Container className="max-w-3xl py-16 sm:py-20">
          <InsightBody markdown={post.body} />
          {post.linkedInUrl ? (
            <p className="mt-10 text-sm text-navy/70">
              <a
                href={post.linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                Also on LinkedIn
              </a>
            </p>
          ) : null}
          <p className="mt-6 text-sm">
            <Link
              href="/insights"
              className="text-primary underline-offset-4 hover:underline"
            >
              All insights
            </Link>
          </p>
        </Container>
      </article>

      <CtaBand />
    </>
  );
}
