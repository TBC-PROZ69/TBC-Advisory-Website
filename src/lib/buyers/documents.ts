import { milestoneApplies, sirsApplies } from "@/lib/buyers/applicability";
import { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/buyers/constants";
import type { BuyerFacts, DocumentStatus, SlotChoice } from "@/lib/buyers/types";

export type SlotWhen = "always" | "sirs" | "milestone";

export type DocumentSlot = {
  id: string;
  title: string;
  detail: string;
  maxFiles: number;
  when: SlotWhen;
};

/**
 * Interim financials are included because a year-end report is often many
 * months old by closing. Governing documents, minutes, and insurance allow
 * more than one file because they usually arrive as separate PDFs, and each
 * upload is capped at 4 MB. ZIP files are not accepted.
 */
export const DOCUMENT_SLOTS: DocumentSlot[] = [
  {
    id: "governing",
    title: "Governing documents",
    detail:
      "Declaration, bylaws, and rules. Separate PDFs are fine. Up to 4 files.",
    maxFiles: 4,
    when: "always",
  },
  {
    id: "budget",
    title: "Current budget",
    detail: "The adopted budget for the current year.",
    maxFiles: 2,
    when: "always",
  },
  {
    id: "reserves",
    title: "Reserve study",
    detail: "The reserve study or the reserve schedule, if one exists.",
    maxFiles: 2,
    when: "always",
  },
  {
    id: "sirs",
    title: "Structural Integrity Reserve Study (SIRS)",
    detail: "Shown for condominiums that may need a SIRS. Skip it if you were told it does not apply.",
    maxFiles: 2,
    when: "sirs",
  },
  {
    id: "milestone",
    title: "Milestone inspection report",
    detail:
      "Shown when a milestone inspection may be due or the building age is unknown. Phase 1 and phase 2 can be separate files.",
    maxFiles: 2,
    when: "milestone",
  },
  {
    id: "minutes",
    title: "Board minutes, last 12 months",
    detail: "One file per meeting is fine. Up to 12 files.",
    maxFiles: 12,
    when: "always",
  },
  {
    id: "insurance",
    title: "Insurance declaration pages",
    detail:
      "Property, wind, flood, and liability if they are separate. Declaration pages are enough.",
    maxFiles: 4,
    when: "always",
  },
  {
    id: "special-assessments",
    title: "Special assessment history and notices",
    detail: "Approved assessments and any notice of one that is only proposed.",
    maxFiles: 4,
    when: "always",
  },
  {
    id: "estoppel",
    title: "Estoppel certificate",
    detail: "The association estoppel for this unit, including the page that shows the expiration date.",
    maxFiles: 2,
    when: "always",
  },
  {
    id: "year-end",
    title: "Year-end financial report",
    detail: "The latest year-end report or audit.",
    maxFiles: 2,
    when: "always",
  },
  {
    id: "interim-financials",
    title: "Most recent interim financial statement",
    detail:
      "The latest monthly or quarterly financials. Added because the year-end report is often old by the time a buyer closes.",
    maxFiles: 2,
    when: "always",
  },
  {
    id: "litigation",
    title: "Pending litigation summary",
    detail:
      "A short summary, an attorney letter, or the estoppel section that lists claims. Do not upload a full court file.",
    maxFiles: 2,
    when: "always",
  },
  {
    id: "resale-disclosure",
    title: "Resale disclosure or question-and-answer sheet",
    detail:
      "The condominium FAQ sheet, or the HOA disclosure packet the contract names.",
    maxFiles: 3,
    when: "always",
  },
];

const SLOT_IDS = new Set(DOCUMENT_SLOTS.map((slot) => slot.id));

export function slotById(id: string) {
  return DOCUMENT_SLOTS.find((slot) => slot.id === id) ?? null;
}

export function slotApplies(slot: DocumentSlot, facts: BuyerFacts) {
  if (slot.when === "always") return true;
  if (slot.when === "sirs") return sirsApplies(facts);
  return milestoneApplies(facts);
}

export function applicableSlots(facts: BuyerFacts) {
  return DOCUMENT_SLOTS.filter((slot) => slotApplies(slot, facts));
}

const EXT_MIME: Record<string, string[]> = {
  pdf: ["application/pdf", "application/octet-stream"],
  png: ["image/png", "application/octet-stream"],
  jpg: ["image/jpeg", "application/octet-stream"],
  jpeg: ["image/jpeg", "application/octet-stream"],
  webp: ["image/webp", "application/octet-stream"],
  gif: ["image/gif", "application/octet-stream"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
    "application/zip",
  ],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
    "application/zip",
  ],
};

const CANONICAL_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "").trim().slice(0, 120);
  return cleaned || "document";
}

function extensionOf(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function includesAscii(bytes: Uint8Array, needle: string) {
  const target = Array.from(needle, (char) => char.charCodeAt(0));
  if (bytes.length < target.length) return false;
  outer: for (let index = 0; index <= bytes.length - target.length; index += 1) {
    for (let offset = 0; offset < target.length; offset += 1) {
      if (bytes[index + offset] !== target[offset]) continue outer;
    }
    return true;
  }
  return false;
}

function looksLikePdf(bytes: Uint8Array) {
  const limit = Math.min(bytes.length, 8);
  for (let index = 0; index < limit; index += 1) {
    const slice = bytes.subarray(index);
    if (
      slice.length >= 4 &&
      slice[0] === 0x25 &&
      slice[1] === 0x50 &&
      slice[2] === 0x44 &&
      slice[3] === 0x46
    ) {
      return true;
    }
    const code = bytes[index] ?? 0;
    if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) break;
  }
  return false;
}

function magicMatches(ext: string, bytes: Uint8Array) {
  if (ext === "pdf") return looksLikePdf(bytes);
  if (ext === "png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
  if (ext === "jpg" || ext === "jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  if (ext === "gif") {
    return includesAscii(bytes.subarray(0, 6), "GIF87a") || includesAscii(bytes.subarray(0, 6), "GIF89a");
  }
  if (ext === "webp") {
    return includesAscii(bytes.subarray(0, 4), "RIFF") && includesAscii(bytes.subarray(8, 12), "WEBP");
  }
  const zip = startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
  if (!zip) return false;
  if (ext === "docx") return includesAscii(bytes, "word/");
  if (ext === "xlsx") return includesAscii(bytes, "xl/") && !includesAscii(bytes, "word/");
  return false;
}

export function inspectUpload(fileName: string, mime: string, bytes: Uint8Array) {
  if (bytes.byteLength === 0) {
    return { ok: false as const, error: "That file is empty." };
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return {
      ok: false as const,
      error: "Each file must be 4 MB or smaller. Split a large PDF across the slots that allow more than one file.",
    };
  }
  const ext = extensionOf(fileName);
  const allowed = EXT_MIME[ext];
  if (!allowed) {
    return {
      ok: false as const,
      error: "Upload a PDF, JPEG, PNG, WEBP, GIF, DOCX, or XLSX file.",
    };
  }
  const normalizedMime = mime.trim().toLowerCase();
  if (normalizedMime && !allowed.includes(normalizedMime)) {
    return {
      ok: false as const,
      error: "That file type does not match the extension.",
    };
  }
  if (!magicMatches(ext, bytes)) {
    return {
      ok: false as const,
      error: "The file contents do not match an allowed document type.",
    };
  }
  return {
    ok: true as const,
    extension: ext,
    contentType: CANONICAL_TYPE[ext] ?? "application/octet-stream",
    fileName: safeFileName(fileName),
  };
}

export function isSlotId(id: string) {
  return SLOT_IDS.has(id);
}

export function isSlotChoice(value: string): value is SlotChoice {
  return value === "not-available" || value === "skipped" || value === "uploaded";
}

export type PublicFile = {
  id: string;
  slot: string;
  fileName: string;
  byteSize: number;
};

export function documentRows(
  facts: BuyerFacts,
  files: PublicFile[],
  choices: Record<string, SlotChoice | "">,
): {
  slot: string;
  title: string;
  status: DocumentStatus;
  files: { fileName: string; byteSize: number }[];
}[] {
  const visible = new Map(applicableSlots(facts).map((slot) => [slot.id, slot]));
  for (const file of files) {
    const slot = slotById(file.slot);
    if (slot) visible.set(slot.id, slot);
  }
  return DOCUMENT_SLOTS.filter((slot) => visible.has(slot.id)).map((slot) => {
    const slotFiles = files.filter((file) => file.slot === slot.id);
    const choice = choices[slot.id] ?? "";
    let status: DocumentStatus = "skipped";
    if (slotFiles.length > 0) status = "received";
    else if (choice === "uploaded") status = "missing";
    else if (choice === "not-available") status = "not-available";
    return {
      slot: slot.id,
      title: slot.title,
      status,
      files: slotFiles.map((file) => ({
        fileName: file.fileName,
        byteSize: file.byteSize,
      })),
    };
  });
}

export function totalsWithinLimits(files: { byteSize: number }[], adding = 0) {
  if (files.length + (adding > 0 ? 1 : 0) > MAX_FILES) {
    return "This packet already has the maximum number of files.";
  }
  const total = files.reduce((sum, file) => sum + file.byteSize, 0) + adding;
  if (total > MAX_TOTAL_BYTES) {
    return "This packet is over the 32 MB total limit.";
  }
  return null;
}
