import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isSubmitTooFast,
  MIN_SUBMIT_MS,
  startedAtFromBody,
} from "@/lib/form-timing";
import {
  resetTurnstileWarningForTests,
  TURNSTILE_VERIFY_URL,
  turnstileTokenFromBody,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { TURNSTILE_REJECTED_ERROR } from "@/lib/turnstile-public";

function siteverifyResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("form timing", () => {
  const now = 1_700_000_000_000;

  it("rejects a submit sooner than three seconds after load", () => {
    expect(isSubmitTooFast(now - (MIN_SUBMIT_MS - 1), now)).toBe(true);
  });

  it("allows a submit once three seconds have passed", () => {
    expect(isSubmitTooFast(now - MIN_SUBMIT_MS, now)).toBe(false);
  });

  it("skips the check when the page did not send a load time", () => {
    expect(isSubmitTooFast(null, now)).toBe(false);
    expect(isSubmitTooFast(0, now)).toBe(false);
    expect(startedAtFromBody({})).toBeNull();
    expect(startedAtFromBody({ form_started_at: "" })).toBeNull();
  });

  it("ignores a client clock that is ahead of the server", () => {
    expect(isSubmitTooFast(now + 5_000, now)).toBe(false);
  });

  it("reads a numeric load time from JSON or a form field", () => {
    expect(startedAtFromBody({ form_started_at: now })).toBe(now);
    expect(startedAtFromBody({ form_started_at: String(now) })).toBe(now);
  });
});

describe("Turnstile verification", () => {
  afterEach(() => {
    resetTurnstileWarningForTests();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it("skips verification and warns when both keys are missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstileToken("token", "203.0.113.10")).resolves.toEqual({
      ok: true,
    });
    await expect(verifyTurnstileToken("token", "203.0.113.10")).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    );
    expect(String(warn.mock.calls[0]?.[0])).toContain("TURNSTILE_SECRET_KEY");
  });

  it("skips verification when only one key is set", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-only");

    await expect(verifyTurnstileToken("", "203.0.113.10")).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    );

    resetTurnstileWarningForTests();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-only");
    await expect(verifyTurnstileToken("token", "203.0.113.10")).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing token without calling Cloudflare when keys are set", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstileToken("  ", "203.0.113.10")).resolves.toEqual({
      ok: false,
      error: TURNSTILE_REJECTED_ERROR,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the token to siteverify and accepts success", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");
    let posted = new URLSearchParams();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      posted = new URLSearchParams(String(init?.body ?? ""));
      expect(url).toBe(TURNSTILE_VERIFY_URL);
      expect(init?.method).toBe("POST");
      return siteverifyResponse({ success: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyTurnstileToken("token-ok", "203.0.113.10"),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(posted.get("secret")).toBe("secret-key");
    expect(posted.get("response")).toBe("token-ok");
    expect(posted.get("remoteip")).toBe("203.0.113.10");
  });

  it("omits an unknown remote IP", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");
    let posted = new URLSearchParams();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        posted = new URLSearchParams(String(init?.body ?? ""));
        return siteverifyResponse({ success: true });
      }),
    );

    await verifyTurnstileToken("token-ok", "unknown");
    expect(posted.get("remoteip")).toBeNull();
  });

  it("rejects a token Cloudflare marks unsuccessful", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        siteverifyResponse({
          success: false,
          "error-codes": ["invalid-input-response"],
        }),
      ),
    );

    await expect(verifyTurnstileToken("bad", "203.0.113.10")).resolves.toEqual({
      ok: false,
      error: TURNSTILE_REJECTED_ERROR,
    });
  });

  it("rejects when siteverify is unreachable", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(verifyTurnstileToken("token", "203.0.113.10")).resolves.toEqual({
      ok: false,
      error: TURNSTILE_REJECTED_ERROR,
    });
  });

  it("reads the token field used by the forms", () => {
    expect(turnstileTokenFromBody({ turnstile_token: " abc " })).toBe("abc");
    expect(
      turnstileTokenFromBody({ "cf-turnstile-response": "from-widget" }),
    ).toBe("from-widget");
    expect(turnstileTokenFromBody({ turnstile_token: 12 })).toBe("");
  });
});
