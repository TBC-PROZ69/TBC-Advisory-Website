import type { MetadataRoute } from "next";

import { getInsights } from "@/lib/insights";
import { SITE_LASTMOD, publicRoutes, sitemapLoc } from "@/lib/seo";

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteLastModified = new Date(SITE_LASTMOD);
  const insights = getInsights();
  const newestInsight = insights[0]?.date;

  const pages: MetadataRoute.Sitemap = publicRoutes.map((path) => ({
    url: sitemapLoc(path),
    lastModified:
      path === "/insights" && newestInsight
        ? utcDate(newestInsight)
        : siteLastModified,
    changeFrequency: path === "" || path === "/insights" ? "monthly" : "yearly",
    priority: path === "" ? 1 : 0.7,
  }));

  const posts: MetadataRoute.Sitemap = insights.map((post) => ({
    url: sitemapLoc(`/insights/${post.slug}`),
    lastModified: utcDate(post.date),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...pages, ...posts];
}
