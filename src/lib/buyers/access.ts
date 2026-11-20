import { grantAccessRecord, defaultMonthlyCap } from "@/lib/buyers/service";
import {
  readSpentIds,
  sealSpentIds,
  verifyToken,
  type TokenPayload,
} from "@/lib/buyers/token";
import type { GrantKind } from "@/lib/buyers/types";

export const SPENT_COOKIE = "tbc_buyers_spent";

export function spentCookieOptions() {
  const deployed =
    process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: deployed,
    path: "/",
    maxAge: 60 * 60 * 24 * 120,
  };
}

export type BuyerSession =
  | {
      ok: true;
      grantId: string;
      kind: GrantKind;
      status: "active" | "spent";
      agentName: string;
      agentEmail: string;
      agentLicense: string;
      overCap: boolean;
      monthlyCap: number | null;
      reportsThisMonth: number;
      payload: TokenPayload;
    }
  | { ok: false; reason: "invalid" | "expired" | "revoked" | "unavailable" };

export async function loadBuyerSession(
  token: string,
  spentCookie?: string,
): Promise<BuyerSession> {
  let payload: TokenPayload | null = null;
  try {
    payload = verifyToken(token);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (!payload) return { ok: false, reason: "invalid" };
  if (payload.exp * 1000 < Date.now()) return { ok: false, reason: "expired" };

  try {
    const { grant, reportsThisMonth, durable } = await grantAccessRecord(payload.id);
    if (durable && !grant) return { ok: false, reason: "invalid" };
    if (grant && grant.kind !== payload.kind) return { ok: false, reason: "invalid" };
    if (grant?.status === "revoked") return { ok: false, reason: "revoked" };
    if (grant && Date.parse(grant.expiresAt) < Date.now()) {
      return { ok: false, reason: "expired" };
    }
    const spentByCookie =
      payload.kind === "one-time" && readSpentIds(spentCookie).includes(payload.id);
    const spent = grant?.status === "spent" || spentByCookie;
    if (payload.kind === "one-time" && spent) {
      return {
        ok: true,
        grantId: payload.id,
        kind: "one-time",
        status: "spent",
        agentName: "",
        agentEmail: "",
        agentLicense: "",
        overCap: false,
        monthlyCap: null,
        reportsThisMonth,
        payload,
      };
    }
    const monthlyCap =
      payload.kind === "agent"
        ? (grant?.monthlyCap ?? defaultMonthlyCap())
        : null;
    const agentName = grant?.agentName || payload.agentName || "";
    const agentEmail = grant?.agentEmail || payload.agentEmail || "";
    const agentLicense = grant?.agentLicense || payload.agentLicense || "";
    return {
      ok: true,
      grantId: payload.id,
      kind: payload.kind,
      status: "active",
      agentName,
      agentEmail,
      agentLicense,
      overCap: monthlyCap !== null && reportsThisMonth >= monthlyCap,
      monthlyCap,
      reportsThisMonth,
      payload,
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function spentIdsFromCookie(value: string | undefined) {
  try {
    return readSpentIds(value);
  } catch {
    return [];
  }
}

export function sealSpentCookie(existing: string | undefined, grantId: string) {
  const ids = [
    grantId,
    ...spentIdsFromCookie(existing).filter((id) => id !== grantId),
  ];
  return sealSpentIds(ids);
}
