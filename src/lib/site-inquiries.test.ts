import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as consultPost } from "@/app/api/consult/route";
import { POST as printPost } from "@/app/api/print-quote/route";
import { MAIL_NOT_CONFIGURED, sendSiteEmail } from "@/lib/mail";
import { allowRequest } from "@/lib/rate-limit";
import {
  consultEmail,
  parseConsultInquiry,
  parsePrintQuoteInquiry,
  printQuoteEmail,
} from "@/lib/site-inquiries";

const validConsult = {
  name: "Jordan Hale",
  email: "jordan@example.com",
  phone: "941-555-0100",
  community: "Palm Court HOA",
  message: "The board needs help with vendor oversight and reserves.",
};

const validPrint = {
  name: "Alex Rivera",
  email: "alex@example.com",
  phone: "941-555-0199",
  organization: "Bayview COA",
  need: "Community placards",
  message: "Twelve 18x24 amenity signs by October.",
};

function jsonRequest(path: string, body: unknown, ip = "203.0.113.10") {
  return new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

describe("consult inquiry parse", () => {
  it("accepts a complete request including optional phone", () => {
    const parsed = parseConsultInquiry(validConsult);
    expect(parsed).toEqual({
      ok: true,
      honeypot: false,
      fields: validConsult,
    });
  });

  it("treats a filled honeypot as a silent success", () => {
    const parsed = parseConsultInquiry({
      ...validConsult,
      hp_trap: "https://spam.example",
    });
    expect(parsed).toEqual({ ok: true, honeypot: true });
  });

  it("rejects a missing community", () => {
    const parsed = parseConsultInquiry({ ...validConsult, community: "  " });
    expect(parsed.ok).toBe(false);
  });
});

describe("consult email", () => {
  it("sets reply-to to the visitor and includes filled fields", () => {
    const email = consultEmail(validConsult);
    expect(email.replyTo).toBe("jordan@example.com");
    expect(email.subject).toContain("Palm Court HOA");
    expect(email.text).toContain("941-555-0100");
    expect(email.text).toContain("vendor oversight");
  });
});

describe("print quote parse and email", () => {
  it("accepts name, email, phone, organization, offering, and notes", () => {
    const parsed = parsePrintQuoteInquiry(validPrint);
    expect(parsed).toEqual({
      ok: true,
      honeypot: false,
      fields: validPrint,
    });
  });

  it("requires a print offering", () => {
    const parsed = parsePrintQuoteInquiry({ ...validPrint, need: "" });
    expect(parsed.ok).toBe(false);
  });

  it("sets reply-to to the visitor and includes every collected field", () => {
    const email = printQuoteEmail(validPrint);
    expect(email.replyTo).toBe("alex@example.com");
    expect(email.subject).toContain("Bayview COA");
    expect(email.text).toContain("Alex Rivera");
    expect(email.text).toContain("941-555-0199");
    expect(email.text).toContain("Community placards");
    expect(email.text).toContain("Twelve 18x24 amenity signs by October.");
  });
});

describe("sendSiteEmail", () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("fails closed when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendSiteEmail({
      subject: "Test",
      text: "Test",
      html: "<p>Test</p>",
      replyTo: "jordan@example.com",
    });
    expect(result).toEqual({ ok: false, error: MAIL_NOT_CONFIGURED });
  });
});

describe("POST /api/consult", () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.unstubAllGlobals();
  });

  it("returns 503 and does not claim success without an API key", async () => {
    delete process.env.RESEND_API_KEY;
    const response = await consultPost(
      jsonRequest("/api/consult", validConsult, "198.51.100.20"),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "We could not send your request. Please try again in a moment.",
    });
  });

  it("returns 200 for a honeypot without sending mail", async () => {
    delete process.env.RESEND_API_KEY;
    const response = await consultPost(
      jsonRequest(
        "/api/consult",
        { ...validConsult, hp_trap: "http://bot.test" },
        "198.51.100.21",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("POST /api/print-quote", () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("returns 503 and does not claim success without an API key", async () => {
    delete process.env.RESEND_API_KEY;
    const response = await printPost(
      jsonRequest("/api/print-quote", validPrint, "198.51.100.30"),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "We could not send your request. Please try again in a moment.",
    });
  });
});

describe("rate limit", () => {
  it("blocks after the window fills", () => {
    const key = `test-${Date.now()}`;
    expect(allowRequest(key, 2, 60_000)).toBe(true);
    expect(allowRequest(key, 2, 60_000)).toBe(true);
    expect(allowRequest(key, 2, 60_000)).toBe(false);
  });
});
