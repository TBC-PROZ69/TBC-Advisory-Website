import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { FILE_TTL_DAYS } from "@/lib/buyers/constants";
import { BuyersError } from "@/lib/buyers/errors";
import { emptyLedger, type Ledger } from "@/lib/buyers/ledger";

const LEDGER_KEY = "buyers/ledger.json";

let queue: Promise<void> = Promise.resolve();
let resolvedDir: string | null = null;
let lastSweepAt = 0;

export function resetBuyersStateForTests() {
  queue = Promise.resolve();
  resolvedDir = null;
  lastSweepAt = 0;
}

export function withBuyersLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export type StorageMode = "temporary-disk" | "private-blob";

export function storageMode(): StorageMode {
  return process.env.BUYERS_STORAGE?.trim() === "blob"
    ? "private-blob"
    : "temporary-disk";
}

export function storageReady() {
  if (storageMode() === "temporary-disk") return true;
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_STORE_ID?.trim(),
  );
}

export function storageIsDurable() {
  return storageMode() === "private-blob" && storageReady();
}

function logSafe(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  const redacted = message
    .replace(/vercel_blob_[a-z0-9_]+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  console.error("Buyers storage error", redacted.slice(0, 300));
}

function assertStorageReady() {
  if (storageMode() === "private-blob" && !storageReady()) {
    throw new BuyersError(
      "Private document storage is selected but not configured.",
      503,
      "storage",
    );
  }
}

function assertDocKey(key: string) {
  if (!/^buyers\/docs\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(key)) {
    throw new BuyersError("Storage key rejected.", 500);
  }
}

function blobAuth() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? { token } : {};
}

async function resolveDir() {
  if (resolvedDir) return resolvedDir;
  const fromEnv = process.env.BUYERS_DATA_DIR?.trim();
  const candidates = fromEnv
    ? [fromEnv]
    : [
        path.join(process.cwd(), ".data", "buyers"),
        path.join("/tmp", "tbc-buyers"),
      ];
  let last: unknown = null;
  for (const dir of candidates) {
    try {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const probe = path.join(dir, ".write-probe");
      await writeFile(probe, "ok", { mode: 0o600 });
      await unlink(probe);
      resolvedDir = dir;
      return dir;
    } catch (error) {
      last = error;
    }
  }
  logSafe(last);
  throw new BuyersError("Buyer records could not be stored on this server.", 500);
}

function diskPath(dir: string, key: string) {
  const full = path.resolve(dir, key);
  const root = path.resolve(dir);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new BuyersError("Storage key rejected.", 500);
  }
  return full;
}

async function readLedgerFile(): Promise<Ledger> {
  assertStorageReady();
  if (storageMode() === "private-blob") return readBlobLedger();
  const dir = await resolveDir();
  try {
    const raw = await readFile(diskPath(dir, "ledger.json"), "utf8");
    const parsed = JSON.parse(raw) as Ledger;
    if (parsed.version !== 1 || !Array.isArray(parsed.grants)) {
      throw new BuyersError("Buyer link records could not be read.", 500);
    }
    parsed.files ??= [];
    parsed.reports ??= [];
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyLedger();
    if (error instanceof BuyersError) throw error;
    logSafe(error);
    throw new BuyersError("Buyer link records could not be read.", 500);
  }
}

async function writeLedgerFile(ledger: Ledger) {
  assertStorageReady();
  if (storageMode() === "private-blob") {
    await writeBlobLedger(ledger);
    return;
  }
  const dir = await resolveDir();
  const dest = diskPath(dir, "ledger.json");
  const tmp = diskPath(dir, `ledger.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(ledger), { mode: 0o600 });
  await rename(tmp, dest);
}

async function readBlobLedger(): Promise<Ledger> {
  const { get } = await import("@vercel/blob");
  try {
    const result = await get(LEDGER_KEY, {
      access: "private",
      useCache: false,
      ...blobAuth(),
    });
    if (!result || result.statusCode !== 200 || !result.stream) return emptyLedger();
    const raw = await new Response(result.stream).text();
    const parsed = JSON.parse(raw) as Ledger;
    if (parsed.version !== 1 || !Array.isArray(parsed.grants)) {
      throw new BuyersError("Buyer link records could not be read.", 500);
    }
    parsed.files ??= [];
    parsed.reports ??= [];
    return parsed;
  } catch (error) {
    if (error instanceof BuyersError) throw error;
    if (error instanceof Error && error.name === "BlobNotFoundError") {
      return emptyLedger();
    }
    logSafe(error);
    throw new BuyersError("Buyer link records could not be read.", 500);
  }
}

async function writeBlobLedger(ledger: Ledger) {
  const { put } = await import("@vercel/blob");
  const saved = await put(LEDGER_KEY, JSON.stringify(ledger), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    ...blobAuth(),
  });
  if (saved.pathname.includes("://")) {
    throw new BuyersError("Storage returned a public address.", 500);
  }
}

export async function readLedger() {
  return readLedgerFile();
}

export async function writeLedger(ledger: Ledger) {
  await writeLedgerFile(ledger);
}

export async function putPrivateBytes(
  key: string,
  bytes: Uint8Array,
  contentType: string,
) {
  assertDocKey(key);
  assertStorageReady();
  if (storageMode() === "private-blob") {
    const { put } = await import("@vercel/blob");
    const saved = await put(key, Buffer.from(bytes), {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 60,
      ttlDays: FILE_TTL_DAYS,
      ...blobAuth(),
    });
    if (saved.pathname.includes("://") || saved.pathname !== key) {
      await import("@vercel/blob")
        .then(({ del }) => del(saved.pathname, blobAuth()))
        .catch((error) => logSafe(error));
      throw new BuyersError("Storage returned an unexpected location.", 500);
    }
    return;
  }
  const dir = await resolveDir();
  const full = diskPath(dir, key);
  await mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
  await writeFile(full, bytes, { mode: 0o600 });
}

export async function deletePrivateBytes(key: string) {
  assertDocKey(key);
  try {
    if (storageMode() === "private-blob") {
      const { del } = await import("@vercel/blob");
      await del(key, blobAuth());
      return;
    }
    const dir = await resolveDir();
    await unlink(diskPath(dir, key));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const name = error instanceof Error ? error.name : "";
    if (code === "ENOENT" || name === "BlobNotFoundError") return;
    logSafe(error);
  }
}

export async function listPrivateDocs(): Promise<
  { key: string; uploadedAt: string }[]
> {
  assertStorageReady();
  if (storageMode() === "private-blob") {
    const { list } = await import("@vercel/blob");
    const found: { key: string; uploadedAt: string }[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({
        prefix: "buyers/docs/",
        cursor,
        limit: 1000,
        ...blobAuth(),
      });
      for (const blob of page.blobs) {
        if (!blob.pathname.startsWith("buyers/docs/")) continue;
        found.push({
          key: blob.pathname,
          uploadedAt: blob.uploadedAt.toISOString(),
        });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return found;
  }
  const dir = await resolveDir();
  const root = diskPath(dir, "buyers/docs");
  const found: { key: string; uploadedAt: string }[] = [];
  async function walk(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      const info = await stat(full);
      const key = path.relative(dir, full).split(path.sep).join("/");
      if (!key.startsWith("buyers/docs/")) continue;
      found.push({ key, uploadedAt: info.mtime.toISOString() });
    }
  }
  await walk(root);
  return found;
}

export function sweepDue(now = Date.now()) {
  return now - lastSweepAt >= 60 * 60 * 1000;
}

export function markSwept(now = Date.now()) {
  lastSweepAt = now;
}
