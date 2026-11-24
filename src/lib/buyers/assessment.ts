import { generateText, Output } from "ai";
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

const chunkSchema = z.object({
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

function plain(value: string) {
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

const RULES = [
  "You prepare checklists and guidance for a Florida condominium or homeowners association buyer.",
  "Use only the text provided. Never invent a dollar amount, percent, date, or name.",
  "Copy figures from the text, then write dollars as $250,100, negative amounts as ($18,400), and percents as 41%. Do not put quotation marks around figures or sentences. Cite the file name and page or sheet.",
  "If a figure is not in the text, omit it. Never write a row whose value is not in the documents.",
  "Do not use em dashes. Do not use the word templates.",
  "Be specific about reserves, budget variance, insurance share of the budget, legal spend, and special assessments when those words and numbers are in the text.",
].join(" ");

function decisionNote(note: MappedNote) {
  const text = `${note.point} ${note.figure}`.toLowerCase();
  if (/not in the documents/.test(text)) return false;
  if (/page\s+\d+\s+of\s+\d+/.test(text)) return false;
  return Boolean(note.figure.trim());
}

function chunkPrompt(text: string) {
  return `List only decision figures in this excerpt: dollar amounts, percents, day limits, weight limits, how many pets, how many times a unit may be leased, approval periods, fees, and how many units are delinquent. At most 8 notes. figure is the value itself, such as $150, 41%, 180 days, or 25 pounds. citation is the file and page from the bracket. If the excerpt has no decision figure, return an empty notes list. Do not note page headers, page numbers, or the absence of a figure.\n\n${text}`;
}

async function callChunk(chunk: DocumentChunk) {
  const result = await generateText({
    model: "openai/gpt-5-mini",
    maxRetries: 1,
    output: Output.object({ schema: chunkSchema }),
    system: RULES,
    prompt: chunkPrompt(chunk.text),
  });
  return result.output?.notes ?? [];
}

function pageSlice(chunk: DocumentChunk, page: string): DocumentChunk {
  const marker = `[${chunk.fileName}, ${page}]`;
  const start = chunk.text.indexOf(marker);
  if (start < 0) return { ...chunk, pages: [page], text: `${chunk.fileName}\n${marker}\n` };
  const rest = chunk.text.slice(start + marker.length);
  const next = rest.indexOf(`\n[${chunk.fileName}, `);
  const body = next < 0 ? rest : rest.slice(0, next);
  return { fileName: chunk.fileName, pages: [page], text: `${chunk.fileName}\n${marker}${body}` };
}

export type ChunkRead = { notes: MappedNote[]; again: DocumentChunk[] };

/** A multi-page chunk that fails is returned as single pages for a later batch. Retrying inside the same burst is what dropped pages 8-14: the provider was already failing. */
export async function readChunk(chunk: DocumentChunk, failedPages: string[]): Promise<ChunkRead> {
  try {
    return { notes: await callChunk(chunk), again: [] };
  } catch (error) {
    console.error(
      "Buyers chunk failed",
      chunk.fileName,
      chunk.pages.join(", "),
      error instanceof Error ? error.name : "error",
    );
  }
  if (chunk.pages.length <= 1) {
    if ((chunk.pass ?? 0) < 1) return { notes: [], again: [{ ...chunk, pass: 1 }] };
    failedPages.push(`${chunk.fileName}, ${chunk.pages[0] ?? "page"}`);
    return { notes: [], again: [] };
  }
  return {
    notes: [],
    again: chunk.pages.map((page) => ({ ...pageSlice(chunk, page), pass: 1 })),
  };
}

export async function assessDocuments(
  report: BuyerReport,
  documents: ExtractedDocument[],
): Promise<BuyerAssessment> {
  const unread = documents.flatMap((doc) => (doc.unread ? [doc.unread] : []));
  const readable = documents.filter((doc) => doc.pages.length > 0);
  if (readable.length === 0) return checklistAssessment(report, unread);

  try {
    const chunks = readable.flatMap((doc) => {
      const docChunks = chunksOf(doc);
      const gaps = coverageGaps(doc, docChunks);
      console.log(
        "Buyers chunk coverage",
        JSON.stringify({
          file: doc.fileName,
          pages: doc.pages.length,
          chunks: docChunks.map((chunk) => chunk.pages),
          gaps,
        }),
      );
      return docChunks;
    });
    const failedPages: string[] = [];
    const pending = [...chunks];
    const notes: MappedNote[] = [];
    while (pending.length > 0) {
      const batch = pending.splice(0, 4);
      const mapped = await mapPool(batch, 3, (chunk) => readChunk(chunk, failedPages));
      notes.push(...mapped.flatMap((item) => item.notes));
      pending.push(...mapped.flatMap((item) => item.again));
    }
    return synthesizeReport(report, notes, failedPages, unread);
  } catch (error) {
    const fallback = checklistAssessment(report, unread);
    fallback.unavailable =
      "Document analysis did not finish. The uploaded files and extracted text were deleted.";
    fallback.dataGaps.push(
      `Analysis stopped (${error instanceof Error ? error.name : "error"}). No document text was kept.`,
    );
    return fallback;
  }
}

export async function synthesizeReport(
  report: BuyerReport,
  notes: MappedNote[],
  failedPages: string[],
  unread: string[],
) {
  try {
    const attached = report.documents
      .filter((item) => item.files.length > 0)
      .map((item) => ({
        checklistItem: item.title,
        files: item.files.map((file) => file.fileName),
      }));
    let output: z.infer<typeof assessmentSchema> | undefined;
    try {
    const result = await generateText({
      model: "openai/gpt-5-mini",
      output: Output.object({ schema: assessmentSchema }),
      system: RULES,
      prompt: `Write the report from the notes the map step extracted. keyNumbers is a curated list of at most 20 real decision figures, deduplicated. Include a row only when a note states the figure: operating budget, budgeted surplus, year-to-date result compared with the budget as ($18,400) vs $12,000 budgeted, reserve cash, recommended reserve balance, percent funded, insurance cost, insurance share of the budget, legal spend compared with its budget, an unfunded capital item, a special assessment, a delinquency total and the number of units, a fee, a lease day limit, a pet count or weight limit, and an approval period. Write day counts as 180 days, never $180 days. Do not include page headers, page numbers, or a row whose value is not in the documents. Put absences in dataGaps once, not in keyNumbers. ${RATING_RULE}\n\nA checklist item marked not in hand is not missing when an attached file's notes already contain that information. Put that on mismatches and do not call it missing in Documentation completeness or dataGaps.\n\n${JSON.stringify({
        association: report.associationName,
        unit: report.unitAddress,
        buyer: report.personName,
        attached,
        markedNotInHand: report.requests.map((item) => item.title),
        doesNotApply: report.notApplicable.map((item) => item.title),
        unread: [...unread, ...failedPages.map((page) => `${page} was not read after one retry.`)],
        notes,
      })}`,
    });
    output = result.output;
    } catch (error) {
      console.error("Buyers reduce failed", error instanceof Error ? error.name : "error");
      output = undefined;
    }
    if (!output) {
      const fallback = checklistAssessment(report, [
        ...unread,
        ...failedPages.map((page) => `${page} was not read after one retry.`),
        "The report synthesis did not finish. Figures below are the ones each chunk returned.",
      ]);
      fallback.keyNumbers = curateKeyNumbers(
        notes.filter(decisionNote).map((note) => {
          const citation = plain(note.citation);
          const comma = citation.lastIndexOf(", ");
          return {
            label: plain(note.point).slice(0, 160),
            value: plain(note.figure),
            source: comma > 0 ? citation.slice(0, comma) : citation,
            page: comma > 0 ? citation.slice(comma + 2) : "",
          };
        }),
      );
      return fallback;
    }
    const keyNumbers = curateKeyNumbers(
      output.keyNumbers.map((row) => ({
        label: plain(row.label),
        value: plain(row.value),
        source: plain(row.source),
        page: plain(row.page),
      })),
    );
    const overallRating = highestRating(
      output.scorecard.map((row) => ({
        domain: row.domain,
        rating: row.rating,
        note: row.note,
      })),
    );
    const unreadPages = failedPages.map((page) => `${page} was not read after one retry.`);
    const bottom = plain(output.bottomLine).replace(
      /^(Low|Moderate|Elevated|High|Critical)\b/,
      overallRating,
    );
    return {
      overallRating,
      bottomLine: bottom.startsWith(overallRating) ? bottom : `${overallRating}. ${bottom}`,
      scorecard: output.scorecard.map((row) => ({ ...row, note: plain(row.note) })),
      keyNumbers,
      findings: output.findings.map((row) => ({
        domain: row.domain,
        whatItSays: plain(row.whatItSays),
        citation: plain(row.citation),
        whyItMatters: plain(row.whyItMatters),
        askBeforeClosing: plain(row.askBeforeClosing),
      })),
      redFlags: output.redFlags.map(plain),
      questions: output.questions.map(plain),
      dataGaps: [...unread, ...unreadPages, ...output.dataGaps.map(plain)],
      mismatches: (output.mismatches ?? []).map((row) => ({
        checklistItem: plain(row.checklistItem),
        marked: plain(row.marked),
        foundIn: plain(row.foundIn),
      })),
      unavailable: null,
    };
  } catch (error) {
    const fallback = checklistAssessment(report, unread);
    fallback.unavailable =
      "Document analysis did not finish. The uploaded files and extracted text were deleted.";
    fallback.dataGaps.push(
      `Analysis stopped (${error instanceof Error ? error.name : "error"}). No document text was kept.`,
    );
    return fallback;
  }
}
