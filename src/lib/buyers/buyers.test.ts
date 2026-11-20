import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buyerQuestions } from "@/data/buyer-questions";
import {
  applicableQuestions,
  milestoneApplies,
  sirsApplies,
} from "@/lib/buyers/applicability";
import { loadBuyerSession, sealSpentCookie } from "@/lib/buyers/access";
import {
  BUYER_DISCLAIMER,
  SCORE_EXPLANATION,
  STANDING_QUESTIONS,
  UPLOAD_CONSENT,
} from "@/lib/buyers/copy";
import { documentRows, inspectUpload } from "@/lib/buyers/documents";
import { BuyersError } from "@/lib/buyers/errors";
import { toIntake, type IntakeDraft } from "@/lib/buyers/intake";
import { buildBuyerReport } from "@/lib/buyers/report";
import { bandFor, scoreQuestions } from "@/lib/buyers/scoring";
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
import type { BuyerFacts, BuyerQuestion } from "@/lib/buyers/types";

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

function condoFacts(over: Partial<BuyerFacts> = {}): BuyerFacts {
  return {
    statute: "718",
    stories3: "yes",
    yearBuilt: 1998,
    coastal: "yes",
    usePlan: "live",
    ...over,
  };
}

function draft(over: Partial<IntakeDraft> = {}): IntakeDraft {
  return {
    completer: "buyer",
    buyerName: "Sample Buyer",
    buyerEmail: "sample.buyer@example.com",
    buyerPhone: "",
    agentName: "",
    agentEmail: "",
    associationName: "Palm Sample Condominium",
    county: "Sarasota",
    statute: "718",
    unit: "12B",
    usePlan: "live",
    stories3: "yes",
    yearBuilt: "1998",
    coastal: "yes",
    notes: "",
    ...over,
  };
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

describe("buyer questions and scoring", () => {
  it("keeps a fixed bank without em dashes", () => {
    expect(buyerQuestions).toHaveLength(42);
    const blobs = [
      UPLOAD_CONSENT,
      BUYER_DISCLAIMER,
      SCORE_EXPLANATION,
      ...STANDING_QUESTIONS,
      ...buyerQuestions.flatMap((question) => [
        question.prompt,
        question.help,
        question.ask,
      ]),
    ];
    for (const text of blobs) {
      expect(text).not.toMatch(/\u2014|\u2013/);
    }
  });

  it("hides SIRS and milestone items that do not apply", () => {
    const hoa = applicableQuestions({
      statute: "720",
      stories3: "no",
      yearBuilt: 2010,
      coastal: "no",
      usePlan: "live",
    }).map((question) => question.id);
    expect(hoa.some((id) => id.startsWith("STR-"))).toBe(false);
    expect(hoa).not.toContain("RES-06");
    expect(hoa).toContain("RES-05");

    const oldCoastal = condoFacts();
    expect(sirsApplies(oldCoastal)).toBe(true);
    expect(milestoneApplies(oldCoastal)).toBe(true);
    expect(applicableQuestions(oldCoastal).map((q) => q.id)).toEqual(
      expect.arrayContaining(["STR-01", "STR-03"]),
    );

    const newer = condoFacts({ yearBuilt: 2020, coastal: "no" });
    expect(milestoneApplies(newer)).toBe(false);
    expect(sirsApplies(newer)).toBe(true);

    const inlandTwenties = condoFacts({ yearBuilt: 2000, coastal: "no" });
    expect(milestoneApplies(inlandTwenties)).toBe(false);
    expect(milestoneApplies(condoFacts({ yearBuilt: 2000, coastal: "yes" }))).toBe(
      true,
    );
  });

  it("scores a bad answer higher than a clean one", () => {
    const good: BuyerQuestion = {
      id: "T-1",
      area: "Insurance",
      prompt: "Seen?",
      help: "Help.",
      ask: "Ask.",
      polarity: "good",
      weight: 1,
      critical: true,
      logic: "ALL",
    };
    const bad: BuyerQuestion = { ...good, id: "T-2", polarity: "bad" };
    expect(scoreQuestions([good], { "T-1": "No" }, true)).toBe(100);
    expect(scoreQuestions([good], { "T-1": "Yes" }, true)).toBe(0);
    expect(scoreQuestions([bad], { "T-2": "Yes" }, true)).toBe(100);
    expect(scoreQuestions([bad], { "T-2": "No" }, true)).toBe(0);
    expect(scoreQuestions([good], { "T-1": "N/A" }, true)).toBeNull();
    expect(bandFor(scoreQuestions([good], {}, true) ?? 0)).toBe("Critical");
  });
});

describe("document checks", () => {
  it("accepts a PDF and rejects a renamed or disallowed file", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF");
    expect(inspectUpload("estoppel.pdf", "application/pdf", pdf).ok).toBe(true);
    expect(inspectUpload("page.html", "text/html", pdf).ok).toBe(false);
    expect(inspectUpload("notes.pdf", "text/html", pdf).ok).toBe(false);
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(inspectUpload("minutes.docx", "application/zip", zip).ok).toBe(false);
    const docx = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("word/document.xml"),
    ]);
    expect(
      inspectUpload(
        "rules.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        docx,
      ).ok,
    ).toBe(true);
    expect(inspectUpload("empty.pdf", "application/pdf", new Uint8Array()).ok).toBe(
      false,
    );
  });

  it("records received, not available, and skipped without a url", () => {
    const rows = documentRows(
      condoFacts(),
      [{ id: "file", slot: "budget", fileName: "budget.pdf", byteSize: 12 }],
      { estoppel: "not-available", minutes: "skipped" },
    );
    const budget = rows.find((row) => row.slot === "budget");
    expect(budget?.status).toBe("received");
    expect(JSON.stringify(budget)).not.toMatch(/https?:|url/i);
    expect(rows.find((row) => row.slot === "estoppel")?.status).toBe("not-available");
    expect(rows.find((row) => row.slot === "minutes")?.status).toBe("skipped");
    expect(rows.some((row) => row.slot === "sirs")).toBe(true);
    expect(
      documentRows(
        { ...condoFacts(), stories3: "no", yearBuilt: 2018, coastal: "no" },
        [],
        {},
      ).some((row) => row.slot === "sirs"),
    ).toBe(false);
  });
});

describe("links, reports, and private files", () => {
  it("spends a one-time link and keeps the agent name on a subscription report", async () => {
    const once = await createOneTimeGrant("Sample closing");
    const token = tokenFrom(once.href);
    const payload = verifyToken(token);
    expect(payload?.kind).toBe("one-time");
    const intake = toIntake(draft(), {
      kind: "one-time",
      agentName: "",
      agentEmail: "",
      agentLicense: "",
    });
    const facts = {
      statute: intake.statute,
      stories3: intake.stories3,
      yearBuilt: intake.yearBuilt,
      coastal: intake.coastal,
      usePlan: intake.usePlan,
    };
    const questions = applicableQuestions(facts);
    const first = await commitBuyerReport({
      payload: payload!,
      intake,
      questions,
      answers: { "RES-02": "No", "SPL-01": "Yes" },
      notes: {},
      choices: {},
      consent: false,
    });
    expect(first.report.redFlags.some((flag) => flag.id === "RES-02")).toBe(true);
    expect(first.report.disclaimer).toContain("not legal advice");
    const session = await loadBuyerSession(token);
    expect(session.ok && session.status).toBe("spent");
    await expect(
      commitBuyerReport({
        payload: payload!,
        intake,
        questions,
        answers: {},
        notes: {},
        choices: {},
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
    const agentIntake = toIntake(draft(), {
      kind: "agent",
      agentName: "Sample Agent",
      agentEmail: "sample.agent@example.com",
      agentLicense: "BK0000000",
    });
    const firstAgent = await commitBuyerReport({
      payload: agentToken!,
      intake: agentIntake,
      questions,
      answers: {},
      notes: {},
      choices: {},
      consent: false,
    });
    expect(firstAgent.report.agentLine).toContain("Sample Agent");
    expect(firstAgent.report.agentLine).toContain("BK0000000");
    expect(firstAgent.overCap).toBe(false);
    const secondAgent = await commitBuyerReport({
      payload: agentToken!,
      intake: agentIntake,
      questions,
      answers: {},
      notes: {},
      choices: {},
      consent: false,
    });
    expect(secondAgent.overCap).toBe(true);
    expect(secondAgent.report.associationName).toBe("Palm Sample Condominium");
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
    const before = await listGrantFiles(payload.id);
    expect(before).toHaveLength(1);
    await sweepStoredFiles(new Date());
    expect(await listGrantFiles(payload.id)).toHaveLength(0);
    const report = buildBuyerReport({
      id: "report",
      createdAt: new Date().toISOString(),
      intake: toIntake(draft(), {
        kind: "one-time",
        agentName: "",
        agentEmail: "",
        agentLicense: "",
      }),
      questions: applicableQuestions(condoFacts()),
      answers: {},
      notes: {},
      files: [],
      choices: { budget: "uploaded" },
      linkKind: "one-time",
      subscriptionAgent: null,
      overCap: false,
      monthlyCap: null,
    });
    expect(report.documents.find((doc) => doc.slot === "budget")?.status).toBe(
      "missing",
    );
    expect(JSON.stringify(report)).not.toContain("%PDF");
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

  it("keeps a young upload on disk as a private file", async () => {
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
    await sweepStoredFiles(new Date());
    const files = await listGrantFiles(payload.id);
    expect(files).toHaveLength(1);
    const ledger = JSON.parse(
      await readFile(path.join(dir, "ledger.json"), "utf8"),
    ) as { files: { storageKey: string }[] };
    const key = ledger.files[0]?.storageKey ?? "";
    expect(key.startsWith("buyers/docs/")).toBe(true);
    expect(key).not.toMatch(/https?:/);
    const info = await stat(path.join(dir, key));
    expect(info.size).toBeGreaterThan(0);
    const intake = toIntake(draft(), {
      kind: "one-time",
      agentName: "",
      agentEmail: "",
      agentLicense: "",
    });
    const done = await commitBuyerReport({
      payload,
      intake,
      questions: applicableQuestions(condoFacts()),
      answers: {},
      notes: {},
      choices: { estoppel: "uploaded" },
      consent: true,
    });
    expect(done.report.documents.find((doc) => doc.slot === "estoppel")?.status).toBe(
      "received",
    );
    await expect(stat(path.join(dir, key))).rejects.toMatchObject({ code: "ENOENT" });
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
    const broken = `${token.slice(0, -4)}aaaa`;
    expect(verifyToken(broken)).toBeNull();
  });
});
