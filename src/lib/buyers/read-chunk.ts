import { generateText, Output } from "ai";

import { chunkSchema, type DocumentChunk, type MappedNote } from "@/lib/buyers/figures";

export const RULES = [
  "You prepare checklists and guidance for a Florida condominium or homeowners association buyer.",
  "Use only the text provided. Never invent a dollar amount, percent, date, or name.",
  "Copy figures from the text, then write dollars as $250,100, negative amounts as ($18,400), and percents as 41%. Do not put quotation marks around figures or sentences. Cite the file name and page or sheet.",
  "If a figure is not in the text, omit it. Never write a row whose value is not in the documents.",
  "Do not use em dashes. Do not use the word templates.",
  "Be specific about reserves, budget variance, insurance share of the budget, legal spend, and special assessments when those words and numbers are in the text.",
].join(" ");

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

/** A failed multi-page chunk is reread one page at a time in a later batch, then once more. */
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
    const pass = chunk.pass ?? 0;
    if (pass < 2) return { notes: [], again: [{ ...chunk, pass: pass + 1 }] };
    failedPages.push(`${chunk.fileName}, ${chunk.pages[0] ?? "page"}`);
    return { notes: [], again: [] };
  }
  return {
    notes: [],
    again: chunk.pages.map((page) => ({ ...pageSlice(chunk, page), pass: 1 })),
  };
}
