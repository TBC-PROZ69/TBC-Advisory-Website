import { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES } from "@/lib/buyers/constants";
import type { BuyerFacts, DocumentStatus, SlotChoice } from "@/lib/buyers/types";

export type SlotWhen = "always" | "structural";

export type DocumentSlot = {
  id: string;
  title: string;
  detail: string;
  maxFiles: number;
  when: SlotWhen;
  signal: "high" | "standard";
  /** Conditional rows can be marked Doesn't apply. That is not a risk finding. */
  allowsNa: boolean;
  missing: string;
  request: string;
  attached: string;
};

/** Buyer-obtainable records, in the order a closing packet is usually gathered. */
export const DOCUMENT_SLOTS: DocumentSlot[] = [
  {
    id: "budget",
    title: "Latest approved budget",
    detail: "The budget the board adopted for the current year.",
    maxFiles: 8,
    when: "always",
    signal: "high",
    allowsNa: false,
    missing:
      "No latest approved budget was provided. Ask the seller or the association for it before closing. Without the budget, the dues you were quoted are just a number.",
    request: "Ask for the latest approved budget.",
    attached:
      "The latest approved budget was attached. This check does not read the file. Look for insurance, reserves, and any one-time money holding the dues down.",
  },
  {
    id: "actuals",
    title: "Latest actuals vs budget",
    detail:
      "The most recent financial statement: balance sheet and income statement, next to the budget if you have both.",
    maxFiles: 8,
    when: "always",
    signal: "high",
    allowsNa: false,
    missing:
      "No recent actuals were provided. Ask for the latest balance sheet and income statement before closing. A budget without actuals does not show whether the association is collecting and spending as planned.",
    request: "Ask for the latest balance sheet and income statement.",
    attached:
      "Recent actuals were attached. This check does not read the file. Compare income and spending with the budget, and note cash and reserve balances.",
  },
  {
    id: "reserves",
    title: "Latest reserve study",
    detail: "The study or schedule that says what the reserves are supposed to cover.",
    maxFiles: 8,
    when: "always",
    signal: "high",
    allowsNa: false,
    missing:
      "No reserve study was provided. Ask the seller or the association for it before closing. A missing reserve study is a risk signal: you cannot see whether reserves match the work still ahead.",
    request: "Ask for the latest reserve study.",
    attached:
      "A reserve study was attached. This check does not read the file. Compare the recommended balance with the cash the association actually holds.",
  },
  {
    id: "sirs",
    title: "SIRS (Structural Integrity Reserve Study)",
    detail: "Required in Florida for condos 3 stories or higher.",
    maxFiles: 8,
    when: "structural",
    signal: "high",
    allowsNa: true,
    missing:
      "No SIRS was provided. Ask whether this building requires a Structural Integrity Reserve Study, and for the current study if it does. A missing SIRS, where one is required, is a risk signal for safety and for a future special assessment.",
    request:
      "Ask for the Structural Integrity Reserve Study, or a written answer that one is not required.",
    attached:
      "A SIRS was attached. This check does not read the file. Look for a near-term funding gap and any recommended special assessment.",
  },
  {
    id: "milestone",
    title: "Milestone inspection report",
    detail: "Required in Florida for condominium and cooperative buildings 3 stories or higher.",
    maxFiles: 8,
    when: "structural",
    signal: "high",
    allowsNa: true,
    missing:
      "No milestone inspection report was provided. Ask whether an inspection is due for this building, and for the report if it is. A missing report, where an inspection was required, is a risk signal.",
    request:
      "Ask for the milestone inspection report, or a written answer that one is not due yet.",
    attached:
      "A milestone report was attached. This check does not read the file. Look for substantial deterioration and repairs that are not finished.",
  },
  {
    id: "governing",
    title: "Governing documents",
    detail: "Declaration, bylaws, and rules and regulations. Separate files are fine.",
    maxFiles: 8,
    when: "always",
    signal: "standard",
    allowsNa: false,
    missing:
      "Governing documents were not provided. Ask for the declaration, bylaws, and rules before closing. Those papers are where rental limits, use rules, and assessment powers usually sit.",
    request: "Ask for the declaration, bylaws, and rules and regulations.",
    attached:
      "Governing documents were attached. This check does not read the file. Read the parts that match how you plan to use the property.",
  },
  {
    id: "year-end",
    title: "Most recent annual or year-end financial report",
    detail: "The latest annual report, year-end financials, or audit.",
    maxFiles: 8,
    when: "always",
    signal: "standard",
    allowsNa: false,
    missing:
      "No year-end financial report or audit was provided. Ask for the latest one. It is the longer record behind the monthly numbers.",
    request: "Ask for the most recent annual or year-end financial report, or the audit.",
    attached:
      "A year-end report was attached. This check does not read the file. Note any comment on reserves, delinquencies, or litigation.",
  },
  {
    id: "minutes",
    title: "Recent board meeting minutes",
    detail: "Minutes for about the last 6 to 12 months. One file per meeting is fine.",
    maxFiles: 12,
    when: "always",
    signal: "standard",
    allowsNa: false,
    missing:
      "Recent board minutes were not provided. Ask for the last 6 to 12 months. Minutes are where special assessments, insurance trouble, and repairs usually show up before a listing does.",
    request: "Ask for board minutes for the last 6 to 12 months.",
    attached:
      "Board minutes were attached. This check does not read the file. Scan for special assessments, insurance, litigation, and unfinished repairs.",
  },
  {
    id: "insurance",
    title: "Insurance declaration pages",
    detail:
      "Master policy declaration pages, including wind and flood if those are separate.",
    maxFiles: 8,
    when: "always",
    signal: "high",
    allowsNa: false,
    missing:
      "Insurance declaration pages were not provided. Ask for them before closing. The deductible, especially wind or flood, can become an owner assessment after a storm.",
    request:
      "Ask for the current insurance declaration pages, including wind and flood if they are separate.",
    attached:
      "Insurance declaration pages were attached. This check does not read the file. Find the wind and flood deductibles and whether owners can be assessed for them.",
  },
  {
    id: "special-assessments",
    title: "Special assessment history or notices",
    detail:
      "Notices or a history of special assessments. If there have been none, choose Doesn't apply.",
    maxFiles: 8,
    when: "always",
    signal: "high",
    allowsNa: true,
    missing:
      "No special assessment history or notices were provided. Ask the association, in writing, whether any special assessment is approved, unpaid, or under discussion, and who must pay it at closing.",
    request: "Ask for special assessment history and any current notices.",
    attached:
      "Special assessment papers were attached. This check does not read the file. Confirm what is still unpaid for this unit and who pays it at closing.",
  },
  {
    id: "estoppel",
    title: "Estoppel certificate or questionnaire",
    detail:
      "The estoppel lists what this unit owes, and then it expires. Choose Doesn't apply only if this closing will not include one.",
    maxFiles: 8,
    when: "always",
    signal: "high",
    allowsNa: true,
    missing:
      "No estoppel or association questionnaire was provided. Ask the closing agent to order the estoppel. It is the association's own list of what this unit owes, and it expires.",
    request: "Ask for the estoppel certificate and read the date it expires.",
    attached:
      "An estoppel or questionnaire was attached. This check does not read the file. Read the amounts due, any special assessment, and the expiration date.",
  },
  {
    id: "litigation",
    title: "Pending litigation disclosure",
    detail:
      "A short disclosure of pending cases. If there is no pending or threatened case, choose Doesn't apply.",
    maxFiles: 8,
    when: "always",
    signal: "standard",
    allowsNa: true,
    missing:
      "No pending litigation disclosure was provided. Ask the association, in writing, whether it is in a lawsuit or has a threatened claim, and whether owners can be assessed for it.",
    request: "Ask for a written litigation disclosure, including threatened claims.",
    attached:
      "A litigation disclosure was attached. This check does not read the file. Note who is involved, what insurance covers, and any deductible owners might pay.",
  },
];

const SLOT_IDS = new Set(DOCUMENT_SLOTS.map((slot) => slot.id));

export function slotById(id: string) {
  return DOCUMENT_SLOTS.find((slot) => slot.id === id) ?? null;
}

/** Every row is shown. Conditional rows use Doesn't apply instead of being hidden. */
export function applicableSlots(facts?: BuyerFacts) {
  void facts;
  return DOCUMENT_SLOTS;
}

export const HEIGHT_NA_SLOTS = ["sirs", "milestone"] as const;

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
      error: "Each file must be 50 MB or smaller.",
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
  return value === "not-available" || value === "not-applicable" || value === "uploaded";
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
    let status: DocumentStatus = "missing";
    // "uploaded" is an answer even when this server instance no longer has the
    // bytes. Preview storage is temporary disk and is not shared across instances.
    if (slotFiles.length > 0 || choice === "uploaded") status = "received";
    else if (choice === "not-applicable") status = "not-applicable";
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
    return "This packet is over the 200 MB total limit.";
  }
  return null;
}
