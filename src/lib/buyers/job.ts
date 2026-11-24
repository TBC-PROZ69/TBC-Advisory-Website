import { BuyersError } from "@/lib/buyers/errors";
import { extractDocument, ocrScannedPdf, type ExtractedDocument } from "@/lib/buyers/extract";
import type { BuyerIntake } from "@/lib/buyers/types";
import type { FileRecord, Ledger } from "@/lib/buyers/ledger";
import { monthKey } from "@/lib/buyers/service";
import {
  chunksOf,
  coverageGaps,
  readChunk,
  synthesizeReport,
  type DocumentChunk,
  type MappedNote,
} from "@/lib/buyers/assessment";
import type { DeclaredFile } from "@/lib/buyers/payload";
import { buildBuyerReport, type BuyerReport } from "@/lib/buyers/report";
import {
  deletePrivateBytes,
  putPrivateBytes,
  readLedger,
  readPrivateBytes,
  withBuyersLock,
  writeLedger,
} from "@/lib/buyers/store";
import type { TokenPayload } from "@/lib/buyers/token";
import { newId } from "@/lib/buyers/token";
import type { SlotChoice } from "@/lib/buyers/types";

const BATCH = 8;

export type BuyerJob = {
  version: 1;
  grantId: string;
  phase: "extract" | "map" | "reduce" | "ready";
  runningUntil: number;
  cursor: number;
  chunks: DocumentChunk[];
  notes: MappedNote[];
  failedPages: string[];
  unread: string[];
  report: BuyerReport;
  fileKeys: string[];
  updatedAt: string;
};

function jobKey(grantId: string) {
  return `buyers/docs/_jobs/${grantId}.json`;
}

async function loadJob(grantId: string): Promise<BuyerJob | null> {
  const bytes = await readPrivateBytes(jobKey(grantId));
  if (!bytes) return null;
  return JSON.parse(new TextDecoder().decode(bytes)) as BuyerJob;
}

async function saveJob(job: BuyerJob) {
  job.updatedAt = new Date().toISOString();
  const key = jobKey(job.grantId);
  await deletePrivateBytes(key);
  await putPrivateBytes(key, new TextEncoder().encode(JSON.stringify(job)), "application/json");
}

function filesFor(
  stored: FileRecord[],
  declared: DeclaredFile[] | undefined,
  choices: Record<string, SlotChoice | "">,
) {
  return declared && stored.length === 0
    ? declared.map((file) => ({ slot: file.slot, fileName: file.fileName, byteSize: file.byteSize }))
    : stored.map((file) => ({
        slot: file.slot,
        fileName: file.fileName,
        byteSize: file.byteSize,
      }));
}

export async function startBuyerJob(input: {
  payload: TokenPayload;
  intake: BuyerIntake;
  notes: Record<string, string>;
  choices: Record<string, SlotChoice | "">;
  consent: boolean;
  spentIds?: string[];
  declaredFiles?: DeclaredFile[];
}) {
  const existing = await loadJob(input.payload.id);
  if (existing && existing.phase !== "ready") {
    return { status: "preparing" as const, done: existing.cursor, total: existing.chunks.length };
  }
  return withBuyersLock(async () => {
    const ledger = await readLedger();
    const grant = ledger.grants.find((item) => item.id === input.payload.id) ?? null;
    if (!grant || grant.status === "revoked" || grant.status === "spent") {
      throw new BuyersError(
        grant?.status === "spent" ? "This one-time link has already been used." : "This link is not active.",
        401,
        grant?.status === "spent" ? "spent" : "invalid",
      );
    }
    if ((input.spentIds ?? []).includes(input.payload.id)) {
      throw new BuyersError("This one-time link has already been used.", 401, "spent");
    }
    const stored = ledger.files.filter((file) => file.grantId === grant.id);
    if (stored.length > 0 && !input.consent) {
      throw new BuyersError("Confirm the consent line before a report can list uploaded files.", 400, "consent");
    }
    const report = buildBuyerReport({
      id: newId(),
      createdAt: new Date().toISOString(),
      intake: input.intake,
      notes: input.notes,
      files: filesFor(stored, input.declaredFiles, input.choices).map((file) => ({
        id: file.fileName,
        slot: file.slot,
        fileName: file.fileName,
        byteSize: file.byteSize,
      })),
      choices: input.choices,
      linkKind: grant.kind,
      subscriptionAgent: grant.kind === "agent" ? { name: grant.agentName, license: grant.agentLicense } : null,
      overCap: false,
      monthlyCap: grant.monthlyCap,
    });
    const job: BuyerJob = {
      version: 1,
      grantId: grant.id,
      phase: "extract",
      runningUntil: 0,
      cursor: 0,
      chunks: [],
      notes: [],
      failedPages: [],
      unread: [],
      report,
      fileKeys: stored.map((file) => file.storageKey),
      updatedAt: new Date().toISOString(),
    };
    grant.status = "spent";
    grant.spentAt = new Date().toISOString();
    await saveJob(job);
    await writeLedger(ledger);
    return { status: "preparing" as const, done: 0, total: 0, kind: grant.kind };
  });
}

async function extractAll(keys: string[], ledger: Ledger): Promise<ExtractedDocument[]> {
  const extracted: ExtractedDocument[] = [];
  for (const key of keys) {
    const file = ledger.files.find((item) => item.storageKey === key);
    const bytes = (await readPrivateBytes(key)) ?? new Uint8Array();
    let doc = await extractDocument(file?.fileName ?? "document", bytes);
    if (bytes.byteLength > 0) {
      const blankPages = doc.pages
        .map((page) => {
          const match = /^page (\d+)$/.exec(page.label);
          return match && page.text.trim().length === 0 ? Number(match[1]) : 0;
        })
        .filter((page) => page > 0);
      if (doc.unread?.includes("scanned without text") || blankPages.length > 0) {
        const ocr = await ocrScannedPdf(doc.fileName, bytes, 0, blankPages.length > 0 ? blankPages : undefined);
        doc = blankPages.length > 0 ? doc : ocr.doc;
      }
    }
    extracted.push(doc);
  }
  return extracted;
}

export async function advanceBuyerJob(grantId: string) {
  const job = await loadJob(grantId);
  if (!job || job.phase === "ready") return { status: "ready" as const, done: 0, total: 0 };
  if (job.runningUntil > Date.now()) {
    return { status: "preparing" as const, done: job.cursor, total: job.chunks.length, busy: true };
  }
  job.runningUntil = Date.now() + 180_000;
  await saveJob(job);
  try {
    if (job.phase === "extract") {
      const ledger = await readLedger();
      const docs = await extractAll(job.fileKeys, ledger);
      job.unread = docs.flatMap((doc) => (doc.unread ? [doc.unread] : []));
      job.chunks = docs.flatMap((doc) => {
        const chunks = chunksOf(doc);
        console.log(
          "Buyers chunk coverage",
          JSON.stringify({
            file: doc.fileName,
            pages: doc.pages.length,
            chunks: chunks.map((chunk) => chunk.pages),
            gaps: coverageGaps(doc, chunks),
          }),
        );
        return chunks;
      });
      job.phase = "map";
      job.cursor = 0;
      job.runningUntil = 0;
      await saveJob(job);
      return { status: "preparing" as const, done: 0, total: job.chunks.length, more: true };
    }
    if (job.phase === "map") {
      const batch = job.chunks.slice(job.cursor, job.cursor + BATCH);
      const failed: string[] = [];
      const mapped = await Promise.all(batch.map((chunk) => readChunk(chunk, failed)));
      job.notes.push(...mapped.flat());
      job.failedPages.push(...failed);
      job.cursor += batch.length;
      if (job.cursor >= job.chunks.length) job.phase = "reduce";
    }
    if (job.phase === "reduce") {
      job.report.assessment = await synthesizeReport(job.report, job.notes, job.failedPages, job.unread);
      const mismatched = job.report.assessment.mismatches ?? [];
      if (mismatched.length > 0) {
        const named = (title: string) =>
          mismatched.some((item) => {
            const marked = item.checklistItem.toLowerCase();
            const current = title.toLowerCase();
            return marked === current || marked.includes(current) || current.includes(marked);
          });
        job.report.requests = job.report.requests.filter((item) => !named(item.title));
        job.report.findings = job.report.findings.filter(
          (item) => item.status !== "not-provided" || !named(item.title),
        );
      }
      await withBuyersLock(async () => {
        const ledger = await readLedger();
        ledger.reports.unshift({
          id: job.report.id,
          grantId: job.grantId,
          createdAt: job.report.createdAt,
          monthKey: monthKey(new Date(job.report.createdAt)),
          overCap: job.report.overCap,
          emailed: false,
          report: job.report,
        });
        const keys = job.fileKeys;
        ledger.files = ledger.files.filter((file) => !keys.includes(file.storageKey));
        await writeLedger(ledger);
        for (const key of keys) await deletePrivateBytes(key);
      });
      job.chunks = [];
      job.notes = [];
      job.phase = "ready";
      await deletePrivateBytes(jobKey(job.grantId));
      return { status: "ready" as const, done: job.cursor, total: job.cursor, report: job.report };
    }
    job.runningUntil = 0;
    await saveJob(job);
    return {
      status: "preparing" as const,
      done: job.cursor,
      total: job.chunks.length,
      more: true,
    };
  } catch (error) {
    job.runningUntil = 0;
    await saveJob(job).catch(() => undefined);
    console.error("Buyers job failed", error instanceof Error ? error.name : "error");
    throw error;
  }
}

export async function buyerJobStatus(grantId: string) {
  const job = await loadJob(grantId);
  if (!job) return null;
  return { status: job.phase === "ready" ? "ready" : "preparing", done: job.cursor, total: job.chunks.length };
}

export function jobNeedsWork(job: { phase: string; runningUntil: number } | null) {
  return Boolean(job && job.phase !== "ready" && job.runningUntil <= Date.now());
}

export async function readBuyerJob(grantId: string) {
  return loadJob(grantId);
}
