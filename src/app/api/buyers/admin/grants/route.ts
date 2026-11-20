import { NextResponse, type NextRequest } from "next/server";

import { BuyersError } from "@/lib/buyers/errors";
import {
  createAgentGrant,
  createOneTimeGrant,
  listAdminGrants,
  revokeGrant,
} from "@/lib/buyers/service";
import { adminGate } from "@/lib/buyers/token";
import { allowRequest, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(error: unknown) {
  if (error instanceof BuyersError) {
    return json({ error: error.message }, error.status);
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("BUYERS_LINK_SECRET")) {
    return json({ error: "Link signing is not configured." }, 503);
  }
  console.error("Buyers admin failed", error instanceof Error ? error.name : "error");
  return json({ error: "The link could not be saved." }, 500);
}

function providedKey(request: NextRequest, body?: Record<string, unknown>) {
  const fromBody = typeof body?.k === "string" ? body.k : undefined;
  return fromBody ?? request.nextUrl.searchParams.get("k") ?? "";
}

export async function GET(request: NextRequest) {
  if (adminGate(providedKey(request)) === "deny") {
    return json({ error: "Unauthorized." }, 401);
  }
  try {
    return json(await listAdminGrants());
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  if (!allowRequest(`buyers-admin:${clientIp(request)}`, 30, 15 * 60 * 1000)) {
    return json({ error: "Too many link requests. Wait a few minutes and try again." }, 429);
  }
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body) return json({ error: "Invalid JSON." }, 400);
  if (adminGate(providedKey(request, body)) === "deny") {
    return json({ error: "Unauthorized." }, 401);
  }
  try {
    if (body.action === "revoke") {
      if (typeof body.id !== "string") return json({ error: "Missing link id." }, 400);
      return json({ grant: await revokeGrant(body.id) });
    }
    if (body.kind === "one-time") {
      const label = typeof body.label === "string" ? body.label : "";
      return json({ grant: await createOneTimeGrant(label) });
    }
    if (body.kind === "agent") {
      const monthlyCap =
        body.monthlyCap === "" || body.monthlyCap === null || body.monthlyCap === undefined
          ? null
          : Number(body.monthlyCap);
      const grant = await createAgentGrant({
        name: typeof body.name === "string" ? body.name : "",
        email: typeof body.email === "string" ? body.email : "",
        license: typeof body.license === "string" ? body.license : "",
        label: typeof body.label === "string" ? body.label : "",
        monthlyCap: monthlyCap === null || Number.isNaN(monthlyCap) ? null : monthlyCap,
      });
      return json({ grant });
    }
    return json({ error: "Choose a one-time link or an agent link." }, 400);
  } catch (error) {
    return fail(error);
  }
}
