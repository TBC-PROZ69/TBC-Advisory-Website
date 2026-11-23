import { extractText } from "unpdf";
import mammoth from "mammoth";
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
