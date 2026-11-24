import { generateText } from "ai";
import mammoth from "mammoth";
import { extractText, renderPageAsImage } from "unpdf";
import * as XLSX from "xlsx";

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
  if (!pages.some((page) => page.text.length > 0)) {
    return {
      fileName,
      pages: [],
      unread: `${fileName} is scanned without text, could not be read.`,
    };
  }
  return { fileName, pages, unread: null };
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
  const workers = Math.min(Math.max(limit, 1), items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/** Reads a scan that has no text layer. Page images are not stored. A page budget of 0 reads every page. */
export async function ocrScannedPdf(
  fileName: string,
  bytes: Uint8Array,
  pageBudget: number,
  onlyPages?: number[],
) {
  let pageNumbers: number[] = [];
  if (onlyPages && onlyPages.length > 0) {
    pageNumbers = onlyPages.filter((page) => page > 0);
  } else {
    try {
      const probe = await extractText(bytes, { mergePages: false });
      const total = probe.totalPages || 0;
      pageNumbers = Array.from({ length: total }, (_, index) => index + 1);
    } catch {
      pageNumbers = [];
    }
  }
  if (pageBudget > 0) pageNumbers = pageNumbers.slice(0, pageBudget);
  if (pageNumbers.length === 0) {
    return {
      doc: {
        fileName,
        pages: [],
        unread: `${fileName} is scanned without text, and no page image could be prepared.`,
      } satisfies ExtractedDocument,
      pagesSent: 0,
    };
  }
  const read = await mapPool(pageNumbers, 4, async (pageNumber) => {
    try {
      const image = await renderPageAsImage(bytes, pageNumber, { scale: 1.25 });
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
      return text ? { label: `OCR page ${pageNumber}`, text } : null;
    } catch {
      return null;
    }
  });
  const pages = read.filter((page): page is ExtractedPage => page !== null);
  let unread: string | null = null;
  if (pages.length < pageNumbers.length) {
    unread = `${fileName}: ${pages.length} of ${pageNumbers.length} image-only pages were read. A page image was not kept.`;
  }
  if (pages.length === 0) {
    unread = `${fileName} is scanned without text, and OCR returned no words.`;
  }
  return { doc: { fileName, pages, unread } satisfies ExtractedDocument, pagesSent: pageNumbers.length };
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
