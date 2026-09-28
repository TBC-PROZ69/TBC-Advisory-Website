import { describe, expect, it } from "vitest";

import { formatInsightDate, getInsight, getInsights } from "@/lib/insights";

const published = [
  {
    slug: "community-communication-practices",
    date: "2026-09-28",
    title: '"We posted it in the lobby" is not a communications plan',
    linkedInUrl: undefined,
  },
  {
    slug: "reserves-into-planned-work",
    date: "2026-09-24",
    title: "Reserves are supposed to turn surprises into planned work",
    linkedInUrl:
      "https://www.linkedin.com/feed/update/urn:li:activity:7508876330826874880/",
  },
  {
    slug: "when-vendors-drift",
    date: "2026-09-21",
    title: "When vendors drift, the board absorbs the cost",
    linkedInUrl:
      "https://www.linkedin.com/feed/update/urn:li:share:7507797705700573184/?actorCompanyId=146489003",
  },
  {
    slug: "after-the-sirs",
    date: "2026-09-17",
    title: "SIRS is done. Now what?",
    linkedInUrl:
      "https://www.linkedin.com/feed/update/urn:li:share:7506342268858011648",
  },
  {
    slug: "budget-is-not-control",
    date: "2026-09-14",
    title: "A board can pass a budget and still lose the year",
    linkedInUrl:
      "https://www.linkedin.com/feed/update/urn:li:share:7505374021773881344/",
  },
  {
    slug: "fees-vs-accountability",
    date: "2026-09-10",
    title: "The invoice is clear. The service standard isn’t.",
    linkedInUrl:
      "https://www.linkedin.com/feed/update/urn:li:share:7503701179210743809/",
  },
] as const;

function wordCount(markdown: string): number {
  const text = markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`]/g, " ");
  return text.split(/\s+/).filter(Boolean).length;
}

describe("published insights", () => {
  it("lists only the published posts, newest first", () => {
    const posts = getInsights();
    expect(posts.map((post) => post.slug)).toEqual(
      published.map((post) => post.slug),
    );

    for (const expected of published) {
      const post = getInsight(expected.slug);
      expect(post?.title).toBe(expected.title);
      expect(post?.date).toBe(expected.date);
      expect(post?.linkedInUrl).toBe(expected.linkedInUrl);
      expect(post?.description.length).toBeGreaterThan(40);
      expect(post?.body.length).toBeGreaterThan(400);
    }
  });

  it("keeps the SIRS disclaimer and expands the short posts", () => {
    const sirs = getInsight("after-the-sirs");
    expect(sirs?.body).toContain(
      "This article is for general operational discussion. It is not legal, engineering, or reserve-study advice.",
    );

    for (const slug of ["budget-is-not-control", "reserves-into-planned-work"]) {
      const count = wordCount(getInsight(slug)?.body ?? "");
      expect(count).toBeGreaterThanOrEqual(500);
      expect(count).toBeLessThanOrEqual(720);
    }
  });

  it("stays in company voice and off the out-of-scope topics", () => {
    const blob = getInsights()
      .map((post) => `${post.title}\n${post.description}\n${post.body}`)
      .join("\n");

    expect(blob).not.toMatch(/Steve Powroznyk/);
    expect(blob).not.toMatch(/\bI sat\b/);
    expect(blob).not.toMatch(/Brush Buddy/);
    expect(blob).not.toMatch(/\/assess\b/);
  });

  it("formats publish dates without shifting the calendar day", () => {
    expect(formatInsightDate("2026-09-10")).toBe("September 10, 2026");
    expect(formatInsightDate("2026-09-24")).toBe("September 24, 2026");
  });
});
