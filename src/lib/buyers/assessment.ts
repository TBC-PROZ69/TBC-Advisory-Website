import { generateText, Output } from "ai";
import type { z } from "zod";

import type { ExtractedDocument } from "@/lib/buyers/extract";
import {
  assessmentSchema,
  checklistAssessment,
  chunksOf,
  coverageGaps,
  curateKeyNumbers,
  highestRating,
  mapPool,
  plain,
  RATING_RULE,
  type BuyerAssessment,
  type DocumentChunk,
  type MappedNote,
} from "@/lib/buyers/figures";
import type { BuyerReport } from "@/lib/buyers/report";
import { readChunk, RULES } from "@/lib/buyers/read-chunk";

export { readChunk } from "@/lib/buyers/read-chunk";

export {
  assessmentSchema,
  checklistAssessment,
  chunksOf,
  coverageGaps,
  curateKeyNumbers,
  DOMAINS,
  highestRating,
  mapPool,
  RATINGS,
  RATING_RULE,
  stripPageChrome,
  type BuyerAssessment,
  type DocumentChunk,
  type MappedNote,
} from "@/lib/buyers/figures";

function decisionNote(note: MappedNote) {
  const text = `${note.point} ${note.figure}`.toLowerCase();
  if (/not in the documents/.test(text)) return false;
  if (/page\s+\d+\s+of\s+\d+/.test(text)) return false;
  return Boolean(note.figure.trim());
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

