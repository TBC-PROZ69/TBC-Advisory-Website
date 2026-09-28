import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { site } from "@/lib/site";
import {
  SITE_LASTMOD,
  assessMetadata,
  canonicalUrl,
  notFoundMetadata,
  publicPageMetadata,
  publicRoutes,
  sitemapLoc,
} from "@/lib/seo";

describe("canonical host", () => {
  it("uses www with no trailing slash on the site origin", () => {
    expect(site.url).toBe("https://www.tbcadvisory.com");
  });

  it("keeps a trailing slash only on the homepage canonical", () => {
    expect(canonicalUrl("/")).toBe("https://www.tbcadvisory.com/");
    expect(canonicalUrl("")).toBe("https://www.tbcadvisory.com/");
    expect(canonicalUrl("/how-we-work")).toBe(
      "https://www.tbcadvisory.com/how-we-work",
    );
    expect(canonicalUrl("/how-we-work/")).toBe(
      "https://www.tbcadvisory.com/how-we-work",
    );
  });

  it("omits trailing slashes from sitemap locs", () => {
    expect(sitemapLoc("")).toBe("https://www.tbcadvisory.com");
    expect(sitemapLoc("/contact")).toBe("https://www.tbcadvisory.com/contact");
  });
});

describe("public page metadata", () => {
  it("sets www canonical, og:url, and matching title/description", () => {
    const meta = publicPageMetadata({
      title: "How we work",
      description: "Four steps.",
      path: "/how-we-work",
    });

    expect(meta.alternates?.canonical).toBe(
      "https://www.tbcadvisory.com/how-we-work",
    );
    expect(meta.openGraph?.url).toBe("https://www.tbcadvisory.com/how-we-work");
    expect(meta.openGraph?.title).toBe("How we work | TBC Advisory");
    expect(meta.openGraph?.description).toBe("Four steps.");
    expect(meta.twitter?.title).toBe("How we work | TBC Advisory");
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("does not point 404 metadata at the homepage", () => {
    const meta = notFoundMetadata();
    expect(meta.title).toEqual({ absolute: "Page not found | TBC Advisory" });
    expect(meta.robots).toBeUndefined();
    expect(meta.openGraph?.url).toBeUndefined();
    expect(meta.alternates?.canonical).toBeUndefined();
    expect(meta.openGraph?.title).toBe("Page not found | TBC Advisory");
  });

  it("keeps /assess noindex without a homepage canonical", () => {
    const meta = assessMetadata();
    expect(meta.robots).toMatchObject({ index: false, follow: false });
    expect(meta.alternates?.canonical).toBeUndefined();
    expect(meta.openGraph?.url).toBeUndefined();
  });
});

describe("sitemap and robots", () => {
  it("lists www public URLs, insight posts, omits /assess, and uses a real lastmod", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);
    const insightPaths = [
      "/insights/community-communication-practices",
      "/insights/reserves-into-planned-work",
      "/insights/when-vendors-drift",
      "/insights/after-the-sirs",
      "/insights/budget-is-not-control",
      "/insights/fees-vs-accountability",
    ];

    expect(urls).toEqual([
      ...publicRoutes.map((path) => sitemapLoc(path)),
      ...insightPaths.map((path) => sitemapLoc(path)),
    ]);
    expect(urls.some((url) => url.includes("assess"))).toBe(false);
    expect(urls.every((url) => !url.endsWith("/") || url === site.url)).toBe(
      true,
    );

    for (const entry of entries) {
      const path = entry.url.replace(site.url, "") || "";
      if (path.startsWith("/insights/")) {
        expect(entry.lastModified).toBeInstanceOf(Date);
        continue;
      }
      if (path === "/insights") {
        expect(entry.lastModified).toEqual(new Date("2026-09-28T00:00:00.000Z"));
        continue;
      }
      expect(entry.lastModified).toEqual(new Date(SITE_LASTMOD));
    }

    const sirs = entries.find((entry) =>
      entry.url.endsWith("/insights/after-the-sirs"),
    );
    expect(sirs?.lastModified).toEqual(new Date("2026-09-17T00:00:00.000Z"));
  });

  it("points robots.txt at the www sitemap and disallows /assess", () => {
    const file = robots();
    expect(file.sitemap).toBe("https://www.tbcadvisory.com/sitemap.xml");
    expect(file.rules).toMatchObject({
      disallow: ["/assess", "/assess/"],
    });
  });
});
