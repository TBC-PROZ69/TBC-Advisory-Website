import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

const INSIGHTS_DIR = path.join(process.cwd(), "content/insights");

export type Insight = {
  title: string;
  description: string;
  /** ISO date, YYYY-MM-DD, matching the LinkedIn publish day. */
  date: string;
  slug: string;
  linkedInUrl?: string;
  body: string;
};

function requireString(value: unknown, field: string, fileName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `${fileName}: frontmatter "${field}" must be a non-empty string`,
    );
  }
  return value.trim();
}

export function formatInsightDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    throw new Error(`Invalid insight date: ${isoDate}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function insightHref(slug: string): string {
  return `/insights/${slug}`;
}

function readInsight(fileName: string): Insight {
  const raw = fs.readFileSync(path.join(INSIGHTS_DIR, fileName), "utf8");
  const { data, content } = matter(raw);
  const slug = requireString(data.slug, "slug", fileName);

  if (fileName !== `${slug}.md`) {
    throw new Error(`${fileName}: slug "${slug}" does not match the filename`);
  }

  const date = requireString(data.date, "date", fileName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${fileName}: date must be a YYYY-MM-DD string`);
  }

  const linkedInUrl =
    data.linkedInUrl === undefined || data.linkedInUrl === null
      ? undefined
      : requireString(data.linkedInUrl, "linkedInUrl", fileName);

  const body = content.trim();
  if (!body) {
    throw new Error(`${fileName}: article body is empty`);
  }

  return {
    title: requireString(data.title, "title", fileName),
    description: requireString(data.description, "description", fileName),
    date,
    slug,
    linkedInUrl,
    body,
  };
}

/** Published insights, newest first. */
export function getInsights(): Insight[] {
  const fileNames = fs
    .readdirSync(INSIGHTS_DIR)
    .filter((name) => name.endsWith(".md"));

  return fileNames
    .map(readInsight)
    .sort((a, b) =>
      a.date === b.date ? a.slug.localeCompare(b.slug) : a.date < b.date ? 1 : -1,
    );
}

export function getInsight(slug: string): Insight | undefined {
  return getInsights().find((post) => post.slug === slug);
}
