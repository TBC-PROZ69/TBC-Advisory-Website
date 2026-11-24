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
});

export type BuyerAssessment = z.infer<typeof assessmentSchema> & {
  unavailable: string | null;
};

const chunkSchema = z.object({
  notes: z.array(
    z.object({
      point: z.string(),
      citation: z.string(),
      figure: z.string(),
    }),
  ),
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
    unavailable: null,
  };
}

const CHUNK_CHARS = 7000;

export function chunksOf(doc: ExtractedDocument) {
  const chunks: string[] = [];
  let current = `${doc.fileName}\n`;
  for (const page of doc.pages) {
    const block = `[${doc.fileName}, ${page.label}]\n${page.text}\n`;
    if (current.length + block.length > CHUNK_CHARS && current.length > doc.fileName.length + 1) {
      chunks.push(current);
      current = `${doc.fileName}\n${block}`;
    } else {
      current += block;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

export type MappedNote = { point: string; citation: string; figure: string };

/** Every money, percent, and day-count line, with its page, so a later page is not dropped. */
export function figuresInDocument(doc: ExtractedDocument): MappedNote[] {
  const notes: MappedNote[] = [];
  for (const page of doc.pages) {
    for (const line of page.text.split(/\n/)) {
      const trimmed = line.replace(/\s+/g, " ").trim();
      const money = trimmed.match(/\$\s?\d[\d,]*(?:\.\d+)?/);
      const percent = trimmed.match(/\d+(?:\.\d+)?\s*(?:percent|%)/i);
      const days = trimmed.match(/\b\d+\s+days\b/i);
      const figure = money?.[0] ?? percent?.[0] ?? days?.[0];
      if (!figure) continue;
      notes.push({
        point: trimmed.slice(0, 400),
        citation: `${doc.fileName}, ${page.label}`,
        figure,
      });
    }
  }
  return notes;
}

async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
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

function digits(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function mergeFigures(
  keyNumbers: BuyerAssessment["keyNumbers"],
  notes: MappedNote[],
) {
  for (const note of notes) {
    const value = note.figure.replace(/[“”"]/g, "").replace(/\$\s+/, "$").trim();
    const amount = digits(value);
    if (!amount) continue;
    const citation = note.citation;
    const comma = citation.lastIndexOf(", ");
    const source = comma > 0 ? citation.slice(0, comma) : citation;
    const page = comma > 0 ? citation.slice(comma + 2) : "";
    const already = keyNumbers.some(
      (row) => digits(row.value) === amount && row.page.replace(/\s+/g, " ").includes(page),
    );
    if (already) continue;
    keyNumbers.push({
      label: plain(note.point).slice(0, 160),
      value,
      source: plain(source),
      page: plain(page),
    });
  }
}

const RULES = [
  "You prepare checklists and guidance for a Florida condominium or homeowners association buyer.",
  "Use only the text provided. Never invent a dollar amount, percent, date, or name.",
  "Copy figures from the text, then write dollars as $250,100, negative amounts as ($18,400), and percents as 41%. Do not put quotation marks around figures or sentences. Cite the file name and page or sheet.",
  "If a figure is not in the text, leave it out and say it was not in the documents.",
  "Do not use em dashes. Do not use the word templates.",
  "Be specific about reserves, budget variance, insurance share of the budget, legal spend, and special assessments when those words and numbers are in the text.",
].join(" ");

export async function assessDocuments(
  report: BuyerReport,
  documents: ExtractedDocument[],
): Promise<BuyerAssessment> {
  const unread = documents.flatMap((doc) => (doc.unread ? [doc.unread] : []));
  const readable = documents.filter((doc) => doc.pages.length > 0);
  if (readable.length === 0) return checklistAssessment(report, unread);

  try {
    const chunks = readable.flatMap((doc) => chunksOf(doc));
    const mapped = await mapPool(chunks, 6, async (chunk) => {
      try {
        const result = await generateText({
          model: "openai/gpt-5-mini",
          output: Output.object({ schema: chunkSchema }),
          system: RULES,
          prompt: `List every dollar amount, percent, day count, and vote rule in this excerpt. Include small fees. One note per figure. The citation is the file name and page from the bracket. If there is no number, return an empty notes list.\n\n${chunk}`,
        });
        return result.output?.notes ?? [];
      } catch {
        return [];
      }
    });
    const pageNotes = readable.flatMap((doc) => figuresInDocument(doc));
    const notes = [...mapped.flat(), ...pageNotes];
    const result = await generateText({
      model: "openai/gpt-5-mini",
      output: Output.object({ schema: assessmentSchema }),
      system: RULES,
      prompt: `Write the report from these extracted notes. Put every figure into keyNumbers, including a small fee on a late page. Do not drop a note because the amount is small.\n\n${JSON.stringify({
        association: report.associationName,
        unit: report.unitAddress,
        buyer: report.personName,
        missing: report.requests.map((item) => item.title),
        doesNotApply: report.notApplicable.map((item) => item.title),
        unread,
        notes,
      })}`,
    });
    const output = result.output;
    if (!output) return checklistAssessment(report, unread);
    const keyNumbers = output.keyNumbers.map((row) => ({
      label: plain(row.label),
      value: plain(row.value),
      source: plain(row.source),
      page: plain(row.page),
    }));
    mergeFigures(keyNumbers, pageNotes);
    return {
      overallRating: output.overallRating,
      bottomLine: plain(output.bottomLine),
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
      dataGaps: [...unread, ...output.dataGaps.map(plain)],
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
