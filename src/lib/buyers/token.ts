import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { GrantKind } from "@/lib/buyers/types";

const PREVIEW_LINK_SECRET = "preview-only-not-a-production-secret";

export type TokenPayload = {
  v: 1;
  id: string;
  kind: GrantKind;
  exp: number;
  agentName?: string;
  agentEmail?: string;
  agentLicense?: string;
};

export function newId() {
  return randomBytes(16).toString("base64url");
}

export function isProduction() {
  return process.env.VERCEL_ENV === "production";
}

export function signingConfigured() {
  return Boolean(process.env.BUYERS_LINK_SECRET?.trim());
}

export function linkSecret() {
  const secret = process.env.BUYERS_LINK_SECRET?.trim() ?? "";
  if (secret) {
    if (secret.length < 16) {
      throw new Error("BUYERS_LINK_SECRET must be at least 16 characters.");
    }
    return secret;
  }
  if (isProduction()) {
    throw new Error("BUYERS_LINK_SECRET is required in production.");
  }
  return PREVIEW_LINK_SECRET;
}

function hmac(message: string) {
  return createHmac("sha256", linkSecret()).update(message).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signToken(payload: TokenPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature || !safeEqual(signature, hmac(body))) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as TokenPayload;
    if (parsed.v !== 1) return null;
    if (parsed.kind !== "one-time" && parsed.kind !== "agent") return null;
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(parsed.id)) return null;
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sealSpentIds(ids: string[]) {
  const body = Buffer.from(JSON.stringify(ids.slice(0, 20))).toString("base64url");
  return `${body}.${hmac(`spent:${body}`)}`;
}

export function readSpentIds(value: string | undefined) {
  if (!value) return [];
  const parts = value.split(".");
  if (parts.length !== 2) return [];
  const [body, signature] = parts;
  if (!body || !signature || !safeEqual(signature, hmac(`spent:${body}`))) {
    return [];
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function timingSafeEqualString(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export type AdminGate = "ok" | "preview" | "deny";

export function adminGate(provided: string | null | undefined): AdminGate {
  const required = process.env.BUYERS_ADMIN_KEY?.trim() ?? "";
  if (required) {
    return timingSafeEqualString(provided ?? "", required) ? "ok" : "deny";
  }
  if (isProduction()) return "deny";
  return "preview";
}
