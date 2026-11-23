import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadBuyerSession, sealSpentCookie } from "@/lib/buyers/access";
import { BUYER_DISCLAIMER, UPLOAD_CONSENT } from "@/lib/buyers/copy";
import {
  applicableSlots,
  DOCUMENT_SLOTS,
  documentRows,
  inspectUpload,
} from "@/lib/buyers/documents";
import { BuyersError } from "@/lib/buyers/errors";
import { toIntake, type IntakeDraft } from "@/lib/buyers/intake";
import { checklistAssessment } from "@/lib/buyers/assessment";
import { buyersPdfFilename, parseReportForPdf, renderBuyerPdf } from "@/lib/buyers/pdf";
import { buildBuyerReport } from "@/lib/buyers/report";
import {
  addBuyerDocument,
  commitBuyerReport,
  createAgentGrant,
  createOneTimeGrant,
  listGrantFiles,
  revokeGrant,
  sweepStoredFiles,
} from "@/lib/buyers/service";
import { resetBuyersStateForTests } from "@/lib/buyers/store";
import { adminGate, linkSecret, verifyToken } from "@/lib/buyers/token";
import type { SlotChoice } from "@/lib/buyers/types";

const ENV_KEYS = [
  "BUYERS_DATA_DIR",
  "BUYERS_LINK_SECRET",
  "BUYERS_STORAGE",
  "BUYERS_ADMIN_KEY",
  "BUYERS_AGENT_MONTHLY_CAP",
  "VERCEL_ENV",
] as const;

let previous: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
let dir = "";

function draft(over: Partial<IntakeDraft> = {}): IntakeDraft {
  return {
    completer: "buyer",
    name: "Sample Buyer",
    email: "sample.buyer@example.com",
    associationName: "Palm Sample Condominium",
    unitAddress: "12B Sample Way",
    state: "FL",
    stories3: "yes",
    ...over,
  };
}

function allMissing(stories: IntakeDraft["stories3"] = "yes") {
  const intake = toIntake(draft({ stories3: stories }));
  const choices: Record<string, SlotChoice> = {};
  for (const slot of applicableSlots({ stories3: intake.stories3, state: intake.state })) {
    choices[slot.id] = "not-available";
  }
  return { intake, choices };
}

function tokenFrom(href: string) {
  return new URL(href, "http://localhost").searchParams.get("t") ?? "";
}

beforeEach(async () => {
  previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  dir = await mkdtemp(path.join(tmpdir(), "tbc-buyers-"));
  process.env.BUYERS_DATA_DIR = dir;
  process.env.BUYERS_LINK_SECRET = "test-link-secret-value";
  delete process.env.BUYERS_STORAGE;
  delete process.env.BUYERS_ADMIN_KEY;
  delete process.env.BUYERS_AGENT_MONTHLY_CAP;
  delete process.env.VERCEL_ENV;
  resetBuyersStateForTests();
});

afterEach(async () => {
  resetBuyersStateForTests();
  for (const key of ENV_KEYS) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
});

describe("checklist", () => {
  it("uses buyer-facing wording without em dashes or the word templates", () => {
    const blobs = [
      UPLOAD_CONSENT,
      BUYER_DISCLAIMER,
      ...DOCUMENT_SLOTS.flatMap((slot) => [
        slot.title,
        slot.detail,
        slot.missing,
        slot.request,
        slot.attached,
      ]),
    ];
    for (const text of blobs) {
      expect(text).not.toMatch(/\u2014|\u2013/);
      expect(text.toLowerCase()).not.toContain("template");
    }
    expect(BUYER_DISCLAIMER.toLowerCase()).toContain("checklist and guidance");
  });

  it("keeps conditional rows on the list and allows Doesn't apply only there", () => {
    const ids = applicableSlots({ stories3: "no", state: "FL" }).map((slot) => slot.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "budget",
        "actuals",
        "reserves",
        "sirs",
        "milestone",
        "governing",
        "year-end",
        "minutes",
        "insurance",
        "special-assessments",
        "estoppel",
        "litigation",
      ]),
    );
    expect(DOCUMENT_SLOTS.find((slot) => slot.id === "sirs")?.allowsNa).toBe(true);
    expect(DOCUMENT_SLOTS.find((slot) => slot.id === "budget")?.allowsNa).toBe(false);
    expect(DOCUMENT_SLOTS.find((slot) => slot.id === "sirs")?.detail).toBe(
      "Required in Florida for condos 3 stories or higher.",
    );
  });

  it("treats a missing document as a finding and a request", () => {
    const { intake, choices } = allMissing("yes");
    choices.budget = "uploaded";
    const report = buildBuyerReport({
      id: "report",
      createdAt: new Date().toISOString(),
      intake,
      files: [{ id: "f", slot: "budget", fileName: "budget.pdf", byteSize: 12 }],
      choices,
      notes: {},
      linkKind: "one-time",
      subscriptionAgent: null,
      overCap: false,
      monthlyCap: null,
    });
    expect(report.findings.some((item) => item.id === "reserves")).toBe(true);
    expect(report.findings.some((item) => item.id === "budget")).toBe(false);
    expect(report.requests.map((item) => item.title)).toContain("Latest reserve study");
    expect(report.requests.map((item) => item.title)).not.toContain("Latest approved budget");
    expect(report.attachedNotes.some((item) => item.id === "budget")).toBe(true);
    choices.sirs = "not-applicable";
    choices.milestone = "not-applicable";
    const neutral = buildBuyerReport({
      id: "report-na",
      createdAt: new Date().toISOString(),
      intake,
      files: [{ id: "f", slot: "budget", fileName: "budget.pdf", byteSize: 12 }],
      choices,
      notes: {},
      linkKind: "one-time",
      subscriptionAgent: null,
      overCap: false,
      monthlyCap: null,
    });
    expect(neutral.findings.some((item) => item.id === "sirs")).toBe(false);
    expect(neutral.requests.some((item) => item.title.includes("SIRS"))).toBe(false);
    expect(neutral.notApplicable.map((item) => item.id)).toEqual(
      expect.arrayContaining(["sirs", "milestone"]),
    );
    expect(() =>
      buildBuyerReport({
        id: "bad",
        createdAt: new Date().toISOString(),
        intake,
        files: [],
        choices: { ...choices, budget: "not-applicable" },
        notes: {},
        linkKind: "one-time",
        subscriptionAgent: null,
        overCap: false,
        monthlyCap: null,
      }),
    ).toThrow(/not applicable/);
    expect(JSON.stringify(report)).not.toContain("%PDF");
    expect(JSON.stringify(report).toLowerCase()).not.toContain("template");
  });

  it("rejects a checklist that leaves a row blank", () => {
    const intake = toIntake(draft({ stories3: "no" }));
    expect(() =>
      buildBuyerReport({
        id: "report",
        createdAt: new Date().toISOString(),
        intake,
        files: [],
        choices: {},
        notes: {},
        linkKind: "one-time",
        subscriptionAgent: null,
        overCap: false,
        monthlyCap: null,
      }),
    ).toThrow(/12 documents still need an answer: Latest approved budget/);
  });

  it("treats an uploaded choice as answered when this instance has no file bytes", () => {
    const { intake, choices } = allMissing("no");
    choices.budget = "uploaded";
    choices.sirs = "not-applicable";
    choices.milestone = "not-applicable";
    const report = buildBuyerReport({
      id: "uploaded-without-bytes",
      createdAt: "2026-11-23T18:00:00.000Z",
      intake,
      files: [{ id: "named", slot: "budget", fileName: "budget.pdf", byteSize: 1200 }],
      choices,
      notes: {},
      linkKind: "one-time",
      subscriptionAgent: null,
      overCap: false,
      monthlyCap: null,
    });
    expect(report.findings.some((item) => item.id === "budget")).toBe(false);
    expect(report.notApplicable.map((item) => item.id)).toEqual(
      expect.arrayContaining(["sirs", "milestone"]),
    );
    expect(report.attachedNotes.find((item) => item.id === "budget")?.files).toEqual([
      "budget.pdf",
    ]);
  });
});

describe("document checks", () => {
  it("accepts a PDF and rejects a renamed or disallowed file", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF");
    expect(inspectUpload("estoppel.pdf", "application/pdf", pdf).ok).toBe(true);
    expect(inspectUpload("page.html", "text/html", pdf).ok).toBe(false);
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(inspectUpload("minutes.docx", "application/zip", zip).ok).toBe(false);
    const docx = new Uint8Array([
      0x50,
      0x4b,
      0x03,
      0x04,
      ...new TextEncoder().encode("word/document.xml"),
    ]);
    expect(
      inspectUpload(
        "rules.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        docx,
      ).ok,
    ).toBe(true);
  });

  it("records attached and not in hand without a url", () => {
    const rows = documentRows(
      { stories3: "no", state: "FL" },
      [{ id: "file", slot: "budget", fileName: "budget.pdf", byteSize: 12 }],
      { estoppel: "not-available" },
    );
    expect(rows.find((row) => row.slot === "budget")?.status).toBe("received");
    expect(rows.find((row) => row.slot === "estoppel")?.status).toBe("not-available");
    expect(rows.some((row) => row.slot === "sirs")).toBe(true);
    expect(
      documentRows(
        { stories3: "no", state: "FL" },
        [],
        { sirs: "not-applicable", budget: "uploaded" },
      ).find((row) => row.slot === "sirs")?.status,
    ).toBe("not-applicable");
    expect(
      documentRows(
        { stories3: "no", state: "FL" },
        [],
        { budget: "uploaded" },
      ).find((row) => row.slot === "budget")?.status,
    ).toBe("received");
    expect(JSON.stringify(rows)).not.toMatch(/https?:|url/i);
  });
});

describe("links, reports, and private files", () => {
  it("spends a one-time link and prints the agent on a subscription report", async () => {
    const once = await createOneTimeGrant("Sample closing");
    const token = tokenFrom(once.href);
    const payload = verifyToken(token);
    const { intake, choices } = allMissing("no");
    const first = await commitBuyerReport({
      payload: payload!,
      intake,
      notes: {},
      choices,
      consent: false,
    });
    expect(first.report.findings.length).toBeGreaterThan(0);
    expect(first.report.disclaimer).toContain("checklist and guidance");
    const session = await loadBuyerSession(token);
    expect(session.ok && session.status).toBe("spent");
    await expect(
      commitBuyerReport({
        payload: payload!,
        intake,
        notes: {},
        choices,
        consent: false,
      }),
    ).rejects.toBeInstanceOf(BuyersError);

    const agent = await createAgentGrant({
      name: "Sample Agent",
      email: "sample.agent@example.com",
      license: "bk0000000",
      monthlyCap: 1,
    });
    const agentToken = verifyToken(tokenFrom(agent.href));
    const firstAgent = await commitBuyerReport({
      payload: agentToken!,
      intake,
      notes: {},
      choices,
      consent: false,
    });
    expect(firstAgent.report.agentLine).toContain("Sample Agent");
    expect(firstAgent.report.agentLine).toContain("BK0000000");
    expect(firstAgent.overCap).toBe(false);
    const secondAgent = await commitBuyerReport({
      payload: agentToken!,
      intake,
      notes: {},
      choices,
      consent: false,
    });
    expect(secondAgent.overCap).toBe(true);
  });

  it("requires consent, deletes aged files, and does not return a url", async () => {
    const once = await createOneTimeGrant("Files");
    const payload = verifyToken(tokenFrom(once.href))!;
    await expect(
      addBuyerDocument({
        grantId: payload.id,
        slot: "budget",
        fileName: "budget.pdf",
        contentType: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.4\n%%EOF"),
        consent: false,
      }),
    ).rejects.toMatchObject({ reason: "consent" });

    const stored = await addBuyerDocument({
      grantId: payload.id,
      slot: "budget",
      fileName: "budget.pdf",
      contentType: "application/pdf",
      bytes: new TextEncoder().encode("%PDF-1.4\n%%EOF"),
      consent: true,
      storedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });
    expect(Object.keys(stored).sort()).toEqual(["byteSize", "fileName", "id", "slot"]);
    await sweepStoredFiles(new Date());
    expect(await listGrantFiles(payload.id)).toHaveLength(0);
  });

  it("blocks a revoked agent link and a spent cookie", async () => {
    const agent = await createAgentGrant({
      name: "Sample Agent",
      email: "sample.agent@example.com",
      license: "SL9999999",
    });
    await revokeGrant(agent.id);
    const revoked = await loadBuyerSession(tokenFrom(agent.href));
    expect(revoked.ok).toBe(false);
    if (!revoked.ok) expect(revoked.reason).toBe("revoked");

    const once = await createOneTimeGrant("Cookie");
    const payload = verifyToken(tokenFrom(once.href))!;
    const cookie = sealSpentCookie(undefined, payload.id);
    const spent = await loadBuyerSession(tokenFrom(once.href), cookie);
    expect(spent.ok && spent.status).toBe("spent");
  });

  it("deletes an uploaded file when the report is produced", async () => {
    const once = await createOneTimeGrant("Young");
    const payload = verifyToken(tokenFrom(once.href))!;
    await addBuyerDocument({
      grantId: payload.id,
      slot: "estoppel",
      fileName: "estoppel.pdf",
      contentType: "application/pdf",
      bytes: new TextEncoder().encode("%PDF-1.4\n1 0 obj\n%%EOF"),
      consent: true,
    });
    const ledger = JSON.parse(await readFile(path.join(dir, "ledger.json"), "utf8")) as {
      files: { storageKey: string }[];
    };
    const key = ledger.files[0]?.storageKey ?? "";
    const { intake, choices } = allMissing("no");
    choices.estoppel = "uploaded";
    const done = await commitBuyerReport({
      payload,
      intake,
      notes: {},
      choices,
      consent: true,
    });
    expect(done.report.documents.find((doc) => doc.slot === "estoppel")?.status).toBe(
      "received",
    );
    expect(done.report.findings.some((item) => item.id === "estoppel")).toBe(false);
    await expect(stat(path.join(dir, key))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await listGrantFiles(payload.id)).toEqual([]);
  });

  it("deletes the file when the report fails, and drops abandoned uploads after 24 hours", async () => {
    const once = await createOneTimeGrant("Cleanup");
    const payload = verifyToken(tokenFrom(once.href));
    const pdf = new TextEncoder().encode("%PDF-1.4\nReserve balance $10\n%%EOF");
    const saved = await addBuyerDocument({
      grantId: payload!.id,
      slot: "reserves",
      fileName: "reserves.pdf",
      contentType: "application/pdf",
      bytes: pdf,
      consent: true,
    });
    await expect(
      commitBuyerReport({
        payload: payload!,
        intake: toIntake(draft()),
        notes: {},
        choices: {},
        consent: true,
      }),
    ).rejects.toThrow(/documents still need an answer/);
    expect(await listGrantFiles(payload!.id)).toEqual([]);
    await expect(stat(path.join(dir, "buyers/docs", payload!.id, saved.id))).rejects.toBeTruthy();

    const kept = await addBuyerDocument({
      grantId: payload!.id,
      slot: "budget",
      fileName: "budget.pdf",
      contentType: "application/pdf",
      bytes: pdf,
      consent: true,
    });
    await sweepStoredFiles(new Date(Date.now() + 25 * 60 * 60 * 1000));
    expect(await listGrantFiles(payload!.id)).toEqual([]);
    const docs = path.join(dir, "buyers", "docs");
    const left = await readdir(docs, { recursive: true }).catch(() => [] as string[]);
    const filesLeft: string[] = [];
    for (const name of left) {
      const info = await stat(path.join(docs, String(name)));
      if (info.isFile()) filesLeft.push(String(name));
    }
    expect(filesLeft).toEqual([]);
    expect(kept.id).toBeTruthy();
  });

  it("keeps an answered upload when the file bytes are not on this instance", async () => {
    const once = await createOneTimeGrant("Other instance");
    const payload = verifyToken(tokenFrom(once.href));
    const { intake, choices } = allMissing("no");
    choices.budget = "uploaded";
    choices.actuals = "uploaded";
    choices.sirs = "not-applicable";
    choices.milestone = "not-applicable";
    const done = await commitBuyerReport({
      payload: payload!,
      intake,
      notes: {},
      choices,
      consent: true,
      declaredFiles: [
        { slot: "budget", fileName: "budget.pdf", byteSize: 100 },
        { slot: "budget", fileName: "notes.pdf", byteSize: 80 },
        { slot: "actuals", fileName: "actuals.xlsx", byteSize: 90 },
      ],
    });
    expect(done.report.attachedNotes.find((item) => item.id === "budget")?.files).toEqual([
      "budget.pdf",
      "notes.pdf",
    ]);
    expect(done.report.notApplicable.map((item) => item.id)).toEqual(
      expect.arrayContaining(["sirs", "milestone"]),
    );
    expect(done.report.findings.some((item) => item.id === "budget")).toBe(false);
  });
});

describe("buyer pdf", () => {
  it("builds a branded PDF from the report already on the page", async () => {
    const { intake, choices } = allMissing("no");
    choices.budget = "uploaded";
    choices.sirs = "not-applicable";
    choices.milestone = "not-applicable";
    const report = buildBuyerReport({
      id: "pdf-report",
      createdAt: "2026-11-23T18:00:00.000Z",
      intake,
      files: [{ id: "f", slot: "budget", fileName: "budget.pdf", byteSize: 100 }],
      choices,
      notes: {},
      linkKind: "one-time",
      subscriptionAgent: null,
      overCap: false,
      monthlyCap: null,
    });
    const filename = buyersPdfFilename(report.associationName, report.createdAt);
    expect(filename).toBe("TBC-Buyers-Health-Check_Palm-Sample-Condominium_2026-11-23.pdf");
    report.assessment = checklistAssessment(report, [
      "governing.pdf is scanned without text, could not be read.",
    ]);
    const bytes = await renderBuyerPdf(parseReportForPdf(report));
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    expect(report.disclaimer.toLowerCase()).not.toContain("template");
    expect(report.disclaimer).not.toContain("\u2014");
  });
});

describe("admin gate", () => {
  it("fails closed in production and open on a preview without a key", () => {
    expect(adminGate("")).toBe("preview");
    process.env.VERCEL_ENV = "production";
    expect(adminGate("anything")).toBe("deny");
    process.env.BUYERS_ADMIN_KEY = "a-long-admin-key";
    expect(adminGate("wrong-long-admin-key")).toBe("deny");
    expect(adminGate("a-long-admin-key")).toBe("ok");
    delete process.env.BUYERS_LINK_SECRET;
    expect(() => linkSecret()).toThrow(/BUYERS_LINK_SECRET/);
  });

  it("rejects a tampered token", async () => {
    const once = await createOneTimeGrant("Tamper");
    const token = tokenFrom(once.href);
    expect(verifyToken(`${token.slice(0, -4)}aaaa`)).toBeNull();
  });
});
