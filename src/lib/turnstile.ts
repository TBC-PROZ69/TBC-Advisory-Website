import {
  TURNSTILE_REJECTED_ERROR,
  turnstileSiteKey,
} from "@/lib/turnstile-public";

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileConfig = {
  siteKey: string;
  secret: string;
};

let warned = false;

export function resetTurnstileWarningForTests() {
  warned = false;
}

export function turnstileConfig(): TurnstileConfig | null {
  const siteKey = turnstileSiteKey();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  if (siteKey && secret) return { siteKey, secret };

  if (!warned) {
    warned = true;
    const missing = [
      siteKey ? null : "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      secret ? null : "TURNSTILE_SECRET_KEY",
    ].filter((name) => name !== null);
    console.warn(
      `Turnstile skipped (${missing.join(", ")} unset). Public forms still accept submissions and the honeypot still drops filled traps. Set both variables to enable Cloudflare Turnstile.`,
    );
  }
  return null;
}

export function turnstileTokenFromBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const raw = body as Record<string, unknown>;
  const value = raw.turnstile_token ?? raw["cf-turnstile-response"];
  return typeof value === "string" ? value.trim() : "";
}

function remoteIp(value: string) {
  const ip = value.trim();
  if (!ip || ip === "unknown") return "";
  if (!/^[0-9a-fA-F:.]+$/.test(ip) || ip.length > 64) return "";
  return ip;
}

export async function verifyTurnstileToken(
  token: string,
  ip: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = turnstileConfig();
  if (!config) return { ok: true };

  const responseToken = token.trim();
  if (!responseToken) {
    return { ok: false, error: TURNSTILE_REJECTED_ERROR };
  }

  const body = new URLSearchParams({
    secret: config.secret,
    response: responseToken,
  });
  const visitorIp = remoteIp(ip);
  if (visitorIp) body.set("remoteip", visitorIp);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error("Turnstile siteverify HTTP", response.status);
      return { ok: false, error: TURNSTILE_REJECTED_ERROR };
    }
    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (!data.success) {
      console.error(
        "Turnstile rejected a form token",
        data["error-codes"] ?? [],
      );
      return { ok: false, error: TURNSTILE_REJECTED_ERROR };
    }
    return { ok: true };
  } catch (error) {
    console.error("Turnstile siteverify failed", error);
    return { ok: false, error: TURNSTILE_REJECTED_ERROR };
  }
}
