import {
  UPLOAD_TTL_MS,
  AGENT_MONTHLY_PRICE_USD,
  AGENT_TOKEN_YEARS,
  DEFAULT_AGENT_MONTHLY_CAP,
  FILE_TTL_DAYS,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  ONE_TIME_LINK_DAYS,
  ONE_TIME_PRICE_USD,
} from "@/lib/buyers/constants";
import { BuyersError } from "@/lib/buyers/errors";
import { looksLikeEmail } from "@/lib/buyers/intake";
import type { FileRecord, GrantRecord, Ledger } from "@/lib/buyers/ledger";
import { slotById } from "@/lib/buyers/documents";
import type { DeclaredFile } from "@/lib/buyers/payload";
import { assessDocuments } from "@/lib/buyers/assessment";
import { extractDocument, ocrScannedPdf } from "@/lib/buyers/extract";
import { buildBuyerReport, type BuyerReport } from "@/lib/buyers/report";
import {
  deletePrivateBytes,
  readPrivateBytes,
  listPrivateDocs,
  markSwept,
  putPrivateBytes,
  readLedger,
  storageIsDurable,
  storageMode,
  storageReady,
  sweepDue,
  withBuyersLock,
  writeLedger,
} from "@/lib/buyers/store";
import { newId, signToken, signingConfigured, type TokenPayload } from "@/lib/buyers/token";
import type { BuyerIntake, SlotChoice } from "@/lib/buyers/types";

const FILE_TTL_MS = FILE_TTL_DAYS * 24 * 60 * 60 * 1000;

export function defaultMonthlyCap() {
  const raw = process.env.BUYERS_AGENT_MONTHLY_CAP?.trim();
  if (!raw) return DEFAULT_AGENT_MONTHLY_CAP;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    return DEFAULT_AGENT_MONTHLY_CAP;
  }
  return value;
}

export function monthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function manualBilling(kind: GrantRecord["kind"]): GrantRecord["billing"] {
  return {
    mode: "manual",
    priceUsd: kind === "one-time" ? ONE_TIME_PRICE_USD : AGENT_MONTHLY_PRICE_USD,
    interval: kind === "one-time" ? "one_time" : "month",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripeCheckoutSessionId: null,
  };
}

function publicFiles(files: FileRecord[]) {
  return files.map((file) => ({
    id: file.id,
    slot: file.slot,
    fileName: file.fileName,
    byteSize: file.byteSize,
  }));
}

function filesForReport(
  serverFiles: ReturnType<typeof publicFiles>,
  declared: DeclaredFile[],
  choices: Record<string, SlotChoice | "">,
) {
  const slotsOnServer = new Set(serverFiles.map((file) => file.slot));
  const remembered = declared
    .filter((file) => choices[file.slot] === "uploaded" && !slotsOnServer.has(file.slot))
    .map((file, index) => ({
      id: `declared-${index}`,
      slot: file.slot,
      fileName: file.fileName,
      byteSize: file.byteSize,
    }));
  return [...serverFiles, ...remembered];
}

function countMonth(ledger: Ledger, grantId: string, key = monthKey()) {
  return ledger.reports.filter(
    (report) => report.grantId === grantId && report.monthKey === key,
  ).length;
}

function capFor(grant: GrantRecord) {
  if (grant.kind !== "agent") return null;
  return grant.monthlyCap ?? defaultMonthlyCap();
}

export function deploymentName() {
  if (process.env.VERCEL_ENV === "production") return "production" as const;
  if (process.env.VERCEL_ENV === "preview") return "preview" as const;
  return "local" as const;
}

export function adminHealth() {
  return {
    storage: storageMode(),
    storageReady: storageReady(),
    durable: storageIsDurable(),
    signing: signingConfigured() ? ("configured" as const) : ("temporary" as const),
    admin: process.env.BUYERS_ADMIN_KEY?.trim()
      ? ("keyed" as const)
      : ("preview" as const),
    monthlyCap: defaultMonthlyCap(),
    prices: {
      oneTimeUsd: ONE_TIME_PRICE_USD,
      agentMonthlyUsd: AGENT_MONTHLY_PRICE_USD,
    },
    fileTtlDays: FILE_TTL_DAYS,
    deployment: deploymentName(),
  };
}

function hrefFor(grant: GrantRecord) {
  const exp = Math.floor(Date.parse(grant.expiresAt) / 1000);
  const token = signToken({
    v: 1,
    id: grant.id,
    kind: grant.kind,
    exp,
    ...(grant.kind === "agent"
      ? {
          agentName: grant.agentName,
          agentEmail: grant.agentEmail,
          agentLicense: grant.agentLicense,
        }
      : {}),
  });
  return `/buyers?t=${encodeURIComponent(token)}`;
}

function toAdminGrant(ledger: Ledger, grant: GrantRecord) {
  const reportsThisMonth = countMonth(ledger, grant.id);
  const monthlyCap = capFor(grant);
  return {
    id: grant.id,
    kind: grant.kind,
    status: grant.status,
    createdAt: grant.createdAt,
    expiresAt: grant.expiresAt,
    label: grant.label,
    agentName: grant.agentName,
    agentEmail: grant.agentEmail,
    agentLicense: grant.agentLicense,
    monthlyCap,
    reportsThisMonth,
    overCap: monthlyCap !== null && reportsThisMonth >= monthlyCap,
    href: hrefFor(grant),
    billing: grant.billing,
  };
}

async function sweepLedger(ledger: Ledger, now = new Date()) {
  const fileCutoff = now.getTime() - UPLOAD_TTL_MS;
  const keep: FileRecord[] = [];
  for (const file of ledger.files) {
    if (Date.parse(file.storedAt) < fileCutoff) {
      await deletePrivateBytes(file.storageKey);
      continue;
    }
    keep.push(file);
  }
  ledger.files = keep;
  const known = new Set(ledger.files.map((file) => file.storageKey));
  const stored = await listPrivateDocs();
  for (const item of stored) {
    if (known.has(item.key)) continue;
    if (!item.key.startsWith("buyers/docs/") || item.key.includes("..")) continue;
    if (Date.parse(item.uploadedAt) < fileCutoff) {
      await deletePrivateBytes(item.key);
    }
  }
  const reportCutoff = now.getTime() - FILE_TTL_MS;
  ledger.reports = ledger.reports.filter(
    (report) => Date.parse(report.createdAt) >= reportCutoff,
  );
  return ledger;
}

async function lockedRead(now = new Date()) {
  const ledger = await readLedger();
  if (!sweepDue(now.getTime())) return ledger;
  try {
    const swept = await sweepLedger(ledger, now);
    await writeLedger(swept);
    markSwept(now.getTime());
    return swept;
  } catch (error) {
    console.error(
      "Buyers file sweep failed",
      error instanceof Error ? error.name : "error",
    );
    return ledger;
  }
}

export async function createOneTimeGrant(label: string) {
  const clean = label.replace(/\s+/g, " ").trim().slice(0, 120);
  return withBuyersLock(async () => {
    const ledger = await lockedRead();
    const now = new Date();
    const expires = addDays(now, ONE_TIME_LINK_DAYS);
    const grant: GrantRecord = {
      id: newId(),
      kind: "one-time",
      status: "active",
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      label: clean || "One-time report",
      agentName: "",
      agentEmail: "",
      agentLicense: "",
      monthlyCap: null,
      spentAt: null,
      revokedAt: null,
      billing: manualBilling("one-time"),
    };
    ledger.grants.unshift(grant);
    await writeLedger(ledger);
    return toAdminGrant(ledger, grant);
  });
}

export async function createAgentGrant(input: {
  name: string;
  email: string;
  license: string;
  label?: string;
  monthlyCap?: number | null;
}) {
  const name = input.name.replace(/\s+/g, " ").trim();
  const email = input.email.trim().toLowerCase();
  const license = input.license.trim().toUpperCase();
  if (name.length < 2 || name.length > 120) {
    throw new BuyersError("Enter the agent's name.", 400, "agent");
  }
  if (!looksLikeEmail(email)) {
    throw new BuyersError("Enter the agent's email.", 400, "agent");
  }
  if (!/^[A-Z0-9-]{4,20}$/.test(license)) {
    throw new BuyersError(
      "Enter a Florida license number using letters, numbers, or hyphens.",
      400,
      "agent",
    );
  }
  let monthlyCap: number | null = null;
  if (input.monthlyCap !== null && input.monthlyCap !== undefined) {
    if (
      !Number.isInteger(input.monthlyCap) ||
      input.monthlyCap < 1 ||
      input.monthlyCap > 500
    ) {
      throw new BuyersError("The monthly cap must be a whole number from 1 to 500.", 400);
    }
    monthlyCap = input.monthlyCap;
  }
  const label = (input.label ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  return withBuyersLock(async () => {
    const ledger = await lockedRead();
    const now = new Date();
    const grant: GrantRecord = {
      id: newId(),
      kind: "agent",
      status: "active",
      createdAt: now.toISOString(),
      expiresAt: addYears(now, AGENT_TOKEN_YEARS).toISOString(),
      label: label || name,
      agentName: name,
      agentEmail: email,
      agentLicense: license,
      monthlyCap,
      spentAt: null,
      revokedAt: null,
      billing: manualBilling("agent"),
    };
    ledger.grants.unshift(grant);
    await writeLedger(ledger);
    return toAdminGrant(ledger, grant);
  });
}

export async function listAdminGrants() {
  return withBuyersLock(async () => {
    const ledger = await lockedRead();
    return {
      health: adminHealth(),
      grants: ledger.grants.slice(0, 100).map((grant) => toAdminGrant(ledger, grant)),
    };
  });
}

export async function revokeGrant(id: string) {
  return withBuyersLock(async () => {
    const ledger = await lockedRead();
    const grant = ledger.grants.find((item) => item.id === id);
    if (!grant) throw new BuyersError("That link was not found.", 404, "missing");
    if (grant.status === "active") {
      grant.status = "revoked";
      grant.revokedAt = new Date().toISOString();
      await writeLedger(ledger);
    }
    return toAdminGrant(ledger, grant);
  });
}

export async function grantAccessRecord(id: string) {
  return withBuyersLock(async () => {
    const ledger = await lockedRead();
    const grant = ledger.grants.find((item) => item.id === id) ?? null;
    return {
      grant,
      reportsThisMonth: grant ? countMonth(ledger, grant.id) : 0,
      durable: storageIsDurable(),
    };
  });
}

export async function listGrantFiles(grantId: string) {
  return withBuyersLock(async () => {
    const ledger = await readLedger();
    return publicFiles(ledger.files.filter((file) => file.grantId === grantId));
  });
}

export async function addBuyerDocument(input: {
  grantId: string;
  slot: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  consent: boolean;
  storedAt?: Date;
}) {
  if (!input.consent) {
    throw new BuyersError("Confirm the consent line before uploading.", 400, "consent");
  }
  const slot = slotById(input.slot);
  if (!slot) throw new BuyersError("That document slot is not recognized.", 400);
  const storedAt = input.storedAt ?? new Date();
  const file: FileRecord = {
    id: newId(),
    grantId: input.grantId,
    slot: slot.id,
    fileName: input.fileName,
    contentType: input.contentType,
    byteSize: input.bytes.byteLength,
    storedAt: storedAt.toISOString(),
    storageKey: `buyers/docs/${input.grantId}/${newId()}`,
  };
  return withBuyersLock(async () => {
    const ledger = await lockedRead();
    const existing = ledger.files.filter((item) => item.grantId === input.grantId);
    const inSlot = existing.filter((item) => item.slot === slot.id);
    if (inSlot.length >= slot.maxFiles) {
      throw new BuyersError(
        `That document already has the maximum of ${slot.maxFiles} files.`,
        400,
      );
    }
    if (existing.length >= MAX_FILES) {
      throw new BuyersError("This packet already has the maximum number of files.", 400);
    }
    const total =
      existing.reduce((sum, item) => sum + item.byteSize, 0) + file.byteSize;
    if (total > MAX_TOTAL_BYTES) {
      throw new BuyersError("This packet is over the 200 MB total limit.", 400);
    }
    await putPrivateBytes(file.storageKey, input.bytes, input.contentType);
    ledger.files.push(file);
    try {
      await writeLedger(ledger);
    } catch (error) {
      await deletePrivateBytes(file.storageKey);
      throw error;
    }
    return {
      id: file.id,
      slot: file.slot,
      fileName: file.fileName,
      byteSize: file.byteSize,
    };
  });
}

export async function registerBuyerBlob(input: {
  grantId: string;
  slot: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  pathname: string;
  consent: boolean;
}) {
  if (!input.consent) {
    throw new BuyersError("Confirm the consent line before uploading.", 400, "consent");
  }
  const slot = slotById(input.slot);
  if (!slot) throw new BuyersError("That document slot is not recognized.", 400);
  const prefix = `buyers/docs/${input.grantId}/`;
  if (!input.pathname.startsWith(prefix) || input.pathname.includes("..")) {
    throw new BuyersError("Storage key rejected.", 400);
  }
  if (input.byteSize < 1 || input.byteSize > MAX_FILE_BYTES) {
    throw new BuyersError("Each file must be 50 MB or smaller.", 400);
  }
  return withBuyersLock(async () => {
    const ledger = await lockedRead();
    const existing = ledger.files.filter((item) => item.grantId === input.grantId);
    const inSlot = existing.filter((item) => item.slot === slot.id);
    if (inSlot.length >= slot.maxFiles) {
      throw new BuyersError(
        `That document already has the maximum of ${slot.maxFiles} files.`,
        400,
      );
    }
    if (existing.length >= MAX_FILES) {
      throw new BuyersError("This packet already has the maximum number of files.", 400);
    }
    const total = existing.reduce((sum, item) => sum + item.byteSize, 0) + input.byteSize;
    if (total > MAX_TOTAL_BYTES) {
      throw new BuyersError("This packet is over the 200 MB total limit.", 400);
    }
    if (existing.some((item) => item.storageKey === input.pathname)) {
      const found = existing.find((item) => item.storageKey === input.pathname)!;
      return {
        id: found.id,
        slot: found.slot,
        fileName: found.fileName,
        byteSize: found.byteSize,
      };
    }
    const file: FileRecord = {
      id: newId(),
      grantId: input.grantId,
      slot: slot.id,
      fileName: input.fileName,
      contentType: input.contentType,
      byteSize: input.byteSize,
      storedAt: new Date().toISOString(),
      storageKey: input.pathname,
    };
    ledger.files.push(file);
    await writeLedger(ledger);
    return {
      id: file.id,
      slot: file.slot,
      fileName: file.fileName,
      byteSize: file.byteSize,
    };
  });
}

export async function removeBuyerDocument(grantId: string, fileId: string) {
  return withBuyersLock(async () => {
    const ledger = await readLedger();
    const file = ledger.files.find(
      (item) => item.id === fileId && item.grantId === grantId,
    );
    if (!file) return;
    ledger.files = ledger.files.filter((item) => item.id !== file.id);
    await writeLedger(ledger);
    await deletePrivateBytes(file.storageKey);
  });
}

function shadowGrant(payload: TokenPayload): GrantRecord {
  const kind = payload.kind;
  return {
    id: payload.id,
    kind,
    status: "active",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    label: kind === "agent" ? payload.agentName || "Agent link" : "One-time report",
    agentName: payload.agentName ?? "",
    agentEmail: payload.agentEmail ?? "",
    agentLicense: payload.agentLicense ?? "",
    monthlyCap: null,
    spentAt: null,
    revokedAt: null,
    billing: manualBilling(kind),
  };
}

export async function sweepStoredFiles(now = new Date()) {
  return withBuyersLock(async () => {
    const ledger = await readLedger();
    const swept = await sweepLedger(ledger, now);
    await writeLedger(swept);
    markSwept(now.getTime());
    return swept.files.length;
  });
}

export async function commitBuyerReport(input: {
  payload: TokenPayload;
  intake: BuyerIntake;
  notes: Record<string, string>;
  choices: Record<string, SlotChoice | "">;
  consent: boolean;
  spentIds?: string[];
  declaredFiles?: DeclaredFile[];
}) {
  return withBuyersLock(async () => {
    if (
      input.payload.kind === "one-time" &&
      (input.spentIds ?? []).includes(input.payload.id)
    ) {
      throw new BuyersError("This one-time link has already been used.", 401, "spent");
    }
    const ledger = await lockedRead();
    let grant = ledger.grants.find((item) => item.id === input.payload.id) ?? null;
    if (!grant) {
      if (storageIsDurable()) {
        throw new BuyersError("This link is not active.", 401, "invalid");
      }
      grant = shadowGrant(input.payload);
      ledger.grants.unshift(grant);
    }
    if (grant.kind !== input.payload.kind) {
      throw new BuyersError("This link is not active.", 401, "invalid");
    }
    if (grant.status === "revoked") {
      throw new BuyersError("This link has been turned off.", 401, "revoked");
    }
    if (grant.status === "spent" || Date.parse(grant.expiresAt) < Date.now()) {
      throw new BuyersError(
        grant.status === "spent"
          ? "This one-time link has already been used."
          : "This link has expired.",
        401,
        grant.status === "spent" ? "spent" : "expired",
      );
    }
    const stored = ledger.files.filter((file) => file.grantId === grant.id);
    const keys = stored.map((file) => file.storageKey);
    const dropFiles = async () => {
      ledger.files = ledger.files.filter((file) => file.grantId !== grant.id);
      for (const key of keys) await deletePrivateBytes(key);
    };
    try {
      const files = filesForReport(publicFiles(stored), input.declaredFiles ?? [], input.choices);
      if (files.length > 0 && !input.consent) {
        throw new BuyersError(
          "Confirm the consent line before a report can list uploaded files.",
          400,
          "consent",
        );
      }
      const monthlyCap = capFor(grant);
      const reportsThisMonth = countMonth(ledger, grant.id);
      const overCap = monthlyCap !== null && reportsThisMonth >= monthlyCap;
      const now = new Date();
      const report = buildBuyerReport({
        id: newId(),
        createdAt: now.toISOString(),
        intake: input.intake,
        notes: input.notes,
        files,
        choices: input.choices,
        linkKind: grant.kind,
        subscriptionAgent:
          grant.kind === "agent"
            ? { name: grant.agentName, license: grant.agentLicense }
            : null,
        overCap,
        monthlyCap,
      });
      const extracted = [];
      for (const file of stored) {
        const bytes = (await readPrivateBytes(file.storageKey)) ?? new Uint8Array();
        let doc = await extractDocument(file.fileName, bytes);
        if (bytes.byteLength > 0) {
          const blankPages = doc.pages
            .map((page) => {
              const match = /^page (\d+)$/.exec(page.label);
              return match && page.text.trim().length === 0 ? Number(match[1]) : 0;
            })
            .filter((page) => page > 0);
          if (doc.unread?.includes("scanned without text") || blankPages.length > 0) {
            const ocr = await ocrScannedPdf(
              file.fileName,
              bytes,
              0,
              blankPages.length > 0 ? blankPages : undefined,
            );
            if (blankPages.length > 0) {
              doc = {
                fileName: doc.fileName,
                pages: doc.pages
                  .map((page) => {
                    const match = /^page (\d+)$/.exec(page.label);
                    const transcribed = match
                      ? ocr.doc.pages.find((item) => item.label === `OCR page ${match[1]}`)?.text
                      : "";
                    return transcribed ? { label: page.label, text: transcribed } : page;
                  })
                  .filter((page) => page.text.trim().length > 0),
                unread: ocr.doc.unread,
              };
            } else {
              doc = ocr.doc;
            }
          }
        }
        extracted.push(doc);
      }
      report.assessment = await assessDocuments(report, extracted);
      extracted.length = 0;
      ledger.reports.unshift({
        id: report.id,
        grantId: grant.id,
        createdAt: report.createdAt,
        monthKey: monthKey(now),
        overCap,
        emailed: false,
        report,
      });
      if (grant.kind === "one-time") {
        grant.status = "spent";
        grant.spentAt = now.toISOString();
      }
      await dropFiles();
      await writeLedger(ledger);
      return { report, overCap, grantId: grant.id, kind: grant.kind };
    } catch (error) {
      await dropFiles();
      await writeLedger(ledger).catch(() => undefined);
      throw error;
    }
  });
}

export async function markReportEmailed(reportId: string) {
  await withBuyersLock(async () => {
    const ledger = await readLedger();
    const row = ledger.reports.find((item) => item.id === reportId);
    if (!row) return;
    row.emailed = true;
    row.report = { ...row.report };
    await writeLedger(ledger);
  });
}

export async function latestReport(grantId: string): Promise<{
  report: BuyerReport;
  emailed: boolean;
} | null> {
  return withBuyersLock(async () => {
    const ledger = await readLedger();
    const row = ledger.reports.find((item) => item.grantId === grantId);
    if (!row) return null;
    return { report: row.report, emailed: row.emailed };
  });
}
