import type { Metadata } from "next";

import { site } from "@/lib/site";

/** Last significant public-site change (www canonicals, per-page OG). */
export const SITE_LASTMOD = "2026-08-31";

export const HOME_TITLE =
  "TBC Advisory | Independent counsel for HOA & COA boards";

const NOT_FOUND_TITLE = "Page not found | TBC Advisory";
const NOT_FOUND_DESCRIPTION =
  "That address is not on the TBC Advisory site. Return home or contact the firm.";

const ASSESS_DESCRIPTION =
  "Unlisted association assessment. This page is not offered for public indexing.";

function stripTrailingSlash(path: string): string {
  if (path === "/" || path === "") {
    return "";
  }
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

/** Canonical URL. Homepage keeps a trailing slash; other paths do not. */
export function canonicalUrl(path: string): string {
  const normalized = stripTrailingSlash(path);
  return normalized === "" ? `${site.url}/` : `${site.url}${normalized}`;
}

/** Sitemap `<loc>`: www host, no trailing slash on any URL. */
export function sitemapLoc(path: string): string {
  return `${site.url}${stripTrailingSlash(path)}`;
}

export const publicRoutes = [
  "",
  "/how-we-work",
  "/for-boards",
  "/about",
  "/insights",
  "/print",
  "/contact",
] as const;

export function publicPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  absoluteTitle?: boolean;
}): Metadata {
  const url = canonicalUrl(path);
  const fullTitle = absoluteTitle ? title : `${title} | ${site.name}`;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url,
      type: "website",
      siteName: site.name,
      locale: "en_US",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: site.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}

export function notFoundMetadata(): Metadata {
  const image = {
    url: `${site.url}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: site.name,
  };

  return {
    title: { absolute: NOT_FOUND_TITLE },
    description: NOT_FOUND_DESCRIPTION,
    // Next.js already emits a single noindex on HTTP 404. Do not set robots
    // here or the page ships both noindex and noindex/follow (or worse,
    // index, follow from a parent layout).
    openGraph: {
      title: NOT_FOUND_TITLE,
      description: NOT_FOUND_DESCRIPTION,
      siteName: site.name,
      type: "website",
      locale: "en_US",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: NOT_FOUND_TITLE,
      description: NOT_FOUND_DESCRIPTION,
      images: [image.url],
    },
  };
}

export function assessMetadata(): Metadata {
  return {
    title: "Association assessment",
    description: ASSESS_DESCRIPTION,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    },
    openGraph: {
      title: `Association assessment | ${site.name}`,
      description: ASSESS_DESCRIPTION,
      siteName: site.name,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: `Association assessment | ${site.name}`,
      description: ASSESS_DESCRIPTION,
    },
  };
}

export function professionalServiceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: site.name,
    url: site.url,
    email: site.email,
    description: site.description,
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Florida",
    },
    sameAs: [site.facebook, site.x],
  };
}
