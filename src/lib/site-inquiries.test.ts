import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as consultPost } from "@/app/api/consult/route";
import { POST as printPost } from "@/app/api/print-quote/route";
import { TOO_FAST_ERROR } from "@/lib/form-timing";
import { MAIL_NOT_CONFIGURED, sendSiteEmail } from "@/lib/mail";
import { allowRequest } from "@/lib/rate-limit";
import {
  consultEmail,
  parseConsultInquiry,
  parsePrintQuoteInquiry,
  printQuoteEmail,
} from "@/lib/site-inquiries";
import { TURNSTILE_VERIFY_URL } from "@/lib/turnstile";
import { TURNSTILE_REJECTED_ERROR } from "@/lib/turnstile-public";

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

  it("does not treat bot-protection fields as part of the email", () => {
    const parsed = parseConsultInquiry({
      ...validConsult,
      hp_trap: "   ",
      turnstile_token: "token",
      form_started_at: "1700000000000",
    });
    expect(parsed).toEqual({
      ok: true,
      honeypot: false,
      fields: validConsult,
    });
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

function enableTurnstile() {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");
}

function siteverify(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/consult", () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it("returns 200 for a honeypot even when Turnstile would reject the token", async () => {
    delete process.env.RESEND_API_KEY;
    enableTurnstile();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await consultPost(
      jsonRequest(
        "/api/consult",
        {
          ...validConsult,
          hp_trap: "http://bot.test",
          turnstile_token: "",
          form_started_at: Date.now(),
        },
        "198.51.100.22",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a submit that arrives immediately after the form loads", async () => {
    delete process.env.RESEND_API_KEY;
    const response = await consultPost(
      jsonRequest(
        "/api/consult",
        { ...validConsult, form_started_at: Date.now() },
        "198.51.100.23",
      ),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: TOO_FAST_ERROR });
  });

  it("rejects a token Cloudflare does not accept and does not email", async () => {
    delete process.env.RESEND_API_KEY;
    enableTurnstile();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () =>
      siteverify({ success: false, "error-codes": ["invalid-input-response"] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await consultPost(
      jsonRequest(
        "/api/consult",
        {
          ...validConsult,
          turnstile_token: "bad-token",
          form_started_at: Date.now() - 10_000,
        },
        "198.51.100.24",
      ),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: TURNSTILE_REJECTED_ERROR,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      TURNSTILE_VERIFY_URL,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("verifies a token before the mailer when keys are set", async () => {
    delete process.env.RESEND_API_KEY;
    enableTurnstile();
    let posted = new URLSearchParams();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      posted = new URLSearchParams(String(init?.body ?? ""));
      return siteverify({ success: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await consultPost(
      jsonRequest(
        "/api/consult",
        {
          ...validConsult,
          turnstile_token: "good-token",
          form_started_at: Date.now() - 10_000,
        },
        "198.51.100.25",
      ),
    );
    expect(response.status).toBe(503);
    expect(posted.get("response")).toBe("good-token");
    expect(posted.get("secret")).toBe("secret-key");
  });
});

describe("POST /api/print-quote", () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it("returns 200 for a honeypot without sending mail", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await printPost(
      jsonRequest(
        "/api/print-quote",
        { ...validPrint, hp_trap: "https://spam.example" },
        "198.51.100.31",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a token Cloudflare does not accept and does not email", async () => {
    delete process.env.RESEND_API_KEY;
    enableTurnstile();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () =>
      siteverify({ success: false, "error-codes": ["timeout-or-duplicate"] }),
    );
    const response = await printPost(
      jsonRequest(
        "/api/print-quote",
        {
          ...validPrint,
          turnstile_token: "bad-token",
          form_started_at: Date.now() - 10_000,
        },
        "198.51.100.32",
      ),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: TURNSTILE_REJECTED_ERROR,
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
