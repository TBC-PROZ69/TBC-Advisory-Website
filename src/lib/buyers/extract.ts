import { generateText } from "ai";
import mammoth from "mammoth";
import { extractText, renderPageAsImage } from "unpdf";
import * as XLSX from "xlsx";

import { OCR_PAGES_PER_FILE } from "@/lib/buyers/constants";

export type ExtractedPage = { label: string; text: string };

export type ExtractedDocument = {
  fileName: string;
  pages: ExtractedPage[];
  /** Set when the file has no readable text. The bytes are not kept. */
  unread: string | null;
};

const MAX_CHARS = 80_000;

function clip(value: string) {
  const clean = value.replace(/\u0000/g, "").trim();
  if (clean.length <= MAX_CHARS) return clean;
  return `${clean.slice(0, MAX_CHARS)}\n[Text after this point was not read.]`;
}

export async function extractDocument(
  fileName: string,
  bytes: Uint8Array,
): Promise<ExtractedDocument> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  try {
    if (ext === "pdf") return await extractPdf(fileName, bytes);
    if (ext === "docx") return await extractDocx(fileName, bytes);
    if (ext === "xlsx" || ext === "xls") return extractSheet(fileName, bytes);
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
      return {
        fileName,
        pages: [],
        unread: `${fileName} is an image, so it could not be read.`,
      };
    }
    return {
      fileName,
      pages: [],
      unread: `${fileName} is not a readable PDF, spreadsheet, or DOCX.`,
    };
  } catch {
    return {
      fileName,
      pages: [],
      unread: `${fileName} could not be read.`,
    };
  }
}

async function extractPdf(fileName: string, bytes: Uint8Array): Promise<ExtractedDocument> {
  const result = await extractText(bytes, { mergePages: false });
  const pages = (Array.isArray(result.text) ? result.text : [result.text]).map((text, index) => ({
    label: `page ${index + 1}`,
    text: clip(text ?? ""),
  }));
  const readable = pages.filter((page) => page.text.length > 0);
  if (readable.length === 0) {
    return {
      fileName,
      pages: [],
      unread: `${fileName} is scanned without text, could not be read.`,
    };
  }
  return { fileName, pages: readable, unread: null };
}

/** Reads a scan that has no text layer. Page images are not stored. */
export async function ocrScannedPdf(fileName: string, bytes: Uint8Array, pageBudget: number) {
  const cap = Math.max(0, Math.min(OCR_PAGES_PER_FILE, pageBudget));
  if (cap === 0) {
    return {
      doc: {
        fileName,
        pages: [],
        unread: `${fileName} is scanned without text. No OCR pages were left in this report's cap.`,
      } satisfies ExtractedDocument,
      pagesSent: 0,
    };
  }
  const pages: ExtractedPage[] = [];
  let total = cap;
  try {
    const probe = await extractText(bytes, { mergePages: false });
    total = Math.min(cap, probe.totalPages || cap);
  } catch {
    total = cap;
  }
  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    let image: ArrayBuffer;
    try {
      image = await renderPageAsImage(bytes, pageNumber, { scale: 1.25 });
    } catch {
      return {
        doc: {
          fileName,
          pages,
          unread:
            pages.length > 0
              ? `${fileName}: OCR stopped after page ${pages.length} because a page image could not be prepared.`
              : `${fileName} is scanned without text. A page image could not be prepared, so it could not be read.`,
        } satisfies ExtractedDocument,
        pagesSent: pages.length,
      };
    }
    try {
      const result = await generateText({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Transcribe the words and figures visible on this scanned page of ${fileName}, page ${pageNumber}. Copy figures exactly. If a word is unreadable, skip it. Do not invent text. Do not use em dashes.`,
              },
              { type: "image", image: new Uint8Array(image), mediaType: "image/png" },
            ],
          },
        ],
      });
      const text = clip(result.text ?? "");
      if (text) pages.push({ label: `OCR page ${pageNumber}`, text });
    } catch {
      return {
        doc: {
          fileName,
          pages,
          unread: `${fileName}: OCR stopped after ${pages.length} page${pages.length === 1 ? "" : "s"}. The vision read did not finish. No page image was kept.`,
        } satisfies ExtractedDocument,
        pagesSent: pageNumber,
      };
    }
  }
  let unread: string | null = null;
  try {
    const probe = await extractText(bytes, { mergePages: false });
    if ((probe.totalPages || 0) > total) {
      unread = `${fileName}: only the first ${total} scanned pages were read by OCR. Later pages were not sent.`;
    }
  } catch {
    unread = null;
  }
  if (pages.length === 0) {
    unread = `${fileName} is scanned without text, and OCR returned no words.`;
  }
  return { doc: { fileName, pages, unread } satisfies ExtractedDocument, pagesSent: total };
}

async function extractDocx(fileName: string, bytes: Uint8Array): Promise<ExtractedDocument> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  const text = clip(result.value ?? "");
  if (!text) {
    return { fileName, pages: [], unread: `${fileName} has no text, could not be read.` };
  }
  return { fileName, pages: [{ label: "document", text }], unread: null };
}

function extractSheet(fileName: string, bytes: Uint8Array): ExtractedDocument {
  const book = XLSX.read(bytes, { type: "array" });
  const pages = book.SheetNames.map((name) => ({
    label: `sheet ${name}`,
    text: clip(XLSX.utils.sheet_to_csv(book.Sheets[name] ?? {})),
  })).filter((page) => page.text.length > 0);
  if (pages.length === 0) {
    return { fileName, pages: [], unread: `${fileName} has no cells, could not be read.` };
  }
  return { fileName, pages, unread: null };
}
