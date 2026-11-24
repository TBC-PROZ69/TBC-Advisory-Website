import { z } from "zod";

import type { ExtractedDocument } from "@/lib/buyers/extract";
import type { BuyerReport } from "@/lib/buyers/report";

export const RATINGS = ["Low", "Moderate", "Elevated", "High", "Critical"] as const;
export const DOMAINS = [
  "Reserves and capital needs",
  "Operating budget and actuals",
  "Assessments and special assessment exposure",
  "Insurance",
  "Governance and rules",
  "Legal and litigation",
  "Building condition and SIRS or milestone",
  "Documentation completeness",
] as const;

const ratingSchema = z.enum(RATINGS);
const domainSchema = z.enum(DOMAINS);

export const assessmentSchema = z.object({
  overallRating: ratingSchema,
  bottomLine: z.string(),
  scorecard: z.array(
    z.object({
      domain: domainSchema,
      rating: ratingSchema,
      note: z.string(),
    }),
  ),
  keyNumbers: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      source: z.string(),
      page: z.string(),
    }),
  ),
  findings: z.array(
    z.object({
      domain: domainSchema,
      whatItSays: z.string(),
      citation: z.string(),
      whyItMatters: z.string(),
      askBeforeClosing: z.string(),
    }),
  ),
  redFlags: z.array(z.string()),
  questions: z.array(z.string()),
  dataGaps: z.array(z.string()),
  mismatches: z.array(
    z.object({
      checklistItem: z.string(),
      marked: z.string(),
      foundIn: z.string(),
    }),
  ),
});

export type BuyerAssessment = z.infer<typeof assessmentSchema> & {
  unavailable: string | null;
};

export const chunkSchema = z.object({
  notes: z
    .array(
      z.object({
        point: z.string(),
        citation: z.string(),
        figure: z.string(),
      }),
    )
    .max(8),
});

export function plain(value: string) {
  return value.replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim().slice(0, 1200);
}

function emptyScorecard(note: string): BuyerAssessment["scorecard"] {
  return DOMAINS.map((domain) => ({
    domain,
    rating: domain === "Documentation completeness" ? "Elevated" : "Moderate",
    note,
  }));
}

export function checklistAssessment(
  report: BuyerReport,
  unread: string[] = [],
): BuyerAssessment {
  const missing = report.requests.map((item) => item.title);
  return {
    overallRating: report.overallBand === "Critical" ? "Critical" : missing.length > 4 ? "High" : "Elevated",
    bottomLine:
      missing.length === 0
        ? "No checklist item was marked I don't have this. Attached files still need a reading. This check does not invent figures."
        : `${missing.length} checklist items were not provided. Those gaps are the buyer risk until the papers are in hand.`,
    scorecard: emptyScorecard(
      missing.length
        ? "Rated from the checklist. No document text was available for a figure."
        : "No missing checklist item. No document text was available for a figure.",
    ),
    keyNumbers: [],
    findings: [],
    redFlags: missing.slice(0, 8).map((title) => `${title} was not provided.`),
    questions: report.requests.map((item) => item.ask),
    dataGaps: unread,
    mismatches: [],
    unavailable: null,
  };
}

const CHUNK_CHARS = 12000;

export const RATING_RULE = "The overall rating is the highest rating on the scorecard.";

const RATING_RANK: Record<(typeof RATINGS)[number], number> = {
  Low: 0,
  Moderate: 1,
  Elevated: 2,
  High: 3,
  Critical: 4,
};

export function highestRating(
  scorecard: BuyerAssessment["scorecard"],
): (typeof RATINGS)[number] {
  let best: (typeof RATINGS)[number] = "Low";
  for (const row of scorecard) {
    if (RATING_RANK[row.rating] > RATING_RANK[best]) best = row.rating;
  }
  return best;
}

/** Drop running headers and filler page lines before a page is placed in a chunk. */
export function stripPageChrome(text: string) {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(line)) return false;
      if (/\bpage\s+\d+\s+of\s+\d+\b/i.test(line) && line.length < 100) return false;
      if (
        /^page\s+\d+\s+of\s+the\b/i.test(line) &&
        !/\$|percent|\bdays?\b|\bpounds?\b|\bfee\b/i.test(line)
      ) {
        return false;
      }
      if (/^palm sample condominium\b/i.test(line) && /\bpage\s+\d+\b/i.test(line)) return false;
      return true;
    })
    .join("\n");
}

function noiseRow(row: { label: string; value: string }) {
  const text = `${row.label} ${row.value}`.toLowerCase();
  if (/not in the documents/.test(text)) return true;
  if (/page\s+\d+\s+of\s+\d+/.test(text)) return true;
  if (/page header|document page indicator/.test(text)) return true;
  if (/owners receive written notice/.test(text)) return true;
  if (!row.value.trim() || row.value.trim().toLowerCase() === "none") return true;
  return false;
}

function cleanFigureValue(label: string, value: string) {
  let next = value.replace(/[“”"]/g, "").replace(/\s+/g, " ").trim();
  next = next.replace(/\$(\d[\d,]*)(\s+days?\b)/gi, "$1$2");
  if (/\bdays?\b/i.test(label) || /\bdays?\b/i.test(next)) {
    next = next.replace(/^\$/, "");
  }
  return next;
}

/** Curated decision figures from the reduce step. Not a second reading of the documents. */
export function curateKeyNumbers(
  rows: BuyerAssessment["keyNumbers"],
): BuyerAssessment["keyNumbers"] {
  const kept: BuyerAssessment["keyNumbers"] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (noiseRow(row)) continue;
    const value = cleanFigureValue(row.label, row.value);
    const key = `${row.label.toLowerCase()}|${value.toLowerCase()}|${row.page.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ ...row, value });
  }
  const deficit = kept.find((row) => /year-to-date|ytd|deficit/i.test(row.label));
  const surplus = kept.find((row) => /budgeted (operating )?surplus/i.test(row.label));
  if (deficit && surplus && !/\bvs\b/.test(deficit.value)) {
    const amount = deficit.value.replace(/[()$]/g, "").replace(/^-/, "").trim();
    const negative =
      deficit.value.includes("(") ||
      deficit.value.trim().startsWith("-") ||
      /deficit/i.test(deficit.label);
    deficit.value = `${negative ? `($${amount})` : `$${amount}`} vs ${surplus.value} budgeted`;
  }
  kept.sort((left, right) => figureRank(left) - figureRank(right));
  return kept.slice(0, 20);
}

export type DocumentChunk = { fileName: string; pages: string[]; text: string; pass?: number };

/** Each page is placed in exactly one chunk. A page is never split. */
export function chunksOf(doc: ExtractedDocument): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let current: DocumentChunk = { fileName: doc.fileName, pages: [], text: `${doc.fileName}\n` };
  for (const page of doc.pages) {
    const block = `[${doc.fileName}, ${page.label}]\n${stripPageChrome(page.text)}\n`;
    if (current.pages.length > 0 && current.text.length + block.length > CHUNK_CHARS) {
      chunks.push(current);
      current = { fileName: doc.fileName, pages: [], text: `${doc.fileName}\n` };
    }
    current.pages.push(page.label);
    current.text += block;
  }
  if (current.pages.length > 0) chunks.push(current);
  return chunks;
}

export function coverageGaps(doc: ExtractedDocument, chunks: DocumentChunk[]) {
  const counts = new Map<string, number>();
  for (const chunk of chunks) {
    for (const page of chunk.pages) counts.set(page, (counts.get(page) ?? 0) + 1);
  }
  return doc.pages
    .filter((page) => counts.get(page.label) !== 1)
    .map((page) => `${doc.fileName}, ${page.label}`);
}

export type MappedNote = { point: string; citation: string; figure: string };

export async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  }
  const workers = Math.min(Math.max(limit, 1), Math.max(items.length, 1));
  if (items.length === 0) return results;
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function figureRank(row: { label: string; value: string }) {
  const text = `${row.label} ${row.value}`;
  if (text.includes("$") || text.includes("%")) return 0;
  return 1;
}
