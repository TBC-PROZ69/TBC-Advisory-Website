import type { MetadataRoute } from "next";

import { SITE_LASTMOD, publicRoutes, sitemapLoc } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(SITE_LASTMOD);

  return publicRoutes.map((path) => ({
    url: sitemapLoc(path),
    lastModified,
    changeFrequency: path === "" ? "monthly" : "yearly",
    priority: path === "" ? 1 : 0.7,
  }));
}
