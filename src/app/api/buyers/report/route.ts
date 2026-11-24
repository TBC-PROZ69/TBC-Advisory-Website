import { after, NextResponse, type NextRequest } from "next/server";

import {
  loadBuyerSession,
  sealSpentCookie,
  SPENT_COOKIE,
  spentCookieOptions,
  spentIdsFromCookie,
} from "@/lib/buyers/access";
import { BuyersError } from "@/lib/buyers/errors";
import {
  parseChoices,
  parseCompletedIntake,
  parseDeclaredFiles,
  parseNotes,
} from "@/lib/buyers/payload";
import { advanceBuyerJob, readBuyerJob, startBuyerJob } from "@/lib/buyers/job";
import { latestReport, markReportEmailed } from "@/lib/buyers/service";
import { allowRequest, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(error: unknown) {
  if (error instanceof BuyersError) {
    return json({ error: error.message, reason: error.reason ?? "" }, error.status);
  }
  console.error("Buyers report failed", error instanceof Error ? error.name : "error");
  return json({ error: "The report could not be prepared." }, 500);
}

function kick(request: NextRequest, token: string) {
  const url = new URL("/api/buyers/report/work", request.url);
  after(() => {
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ t: token }),
    });
  });
}

function tokenFrom(value: unknown) {
  if (typeof value !== "string" || value.length < 20 || value.length > 4000) {
    throw new BuyersError("This link is not valid.", 401, "invalid");
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    if (!allowRequest(`buyers-report-get:${clientIp(request)}`, 400, 15 * 60 * 1000)) {
      return json({ error: "Too many requests. Wait a few minutes and try again." }, 429);
    }
    const token = tokenFrom(request.nextUrl.searchParams.get("t"));
    const session = await loadBuyerSession(
      token,
      request.cookies.get(SPENT_COOKIE)?.value,
    );
    if (!session.ok) {
      return json({ error: "This link is not active.", reason: session.reason }, 401);
    }
    const found = await latestReport(session.grantId);
    if (found) return json(found);
    const job = await readBuyerJob(session.grantId);
    if (job && job.phase !== "ready") {
      if (job.runningUntil <= Date.now()) kick(request, token);
      return json({ status: "preparing", done: job.cursor, total: job.chunks.length });
    }
    return json({ error: "No report is stored for this link." }, 404);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!body) return json({ error: "Invalid JSON." }, 400);
    const token = tokenFrom(body.t);
    if (!allowRequest(`buyers-report:${token.slice(0, 24)}`, 8, 15 * 60 * 1000)) {
      return json({ error: "Too many report requests. Wait a few minutes and try again." }, 429);
    }
    const cookie = request.cookies.get(SPENT_COOKIE)?.value;
    const session = await loadBuyerSession(token, cookie);
    if (!session.ok) {
      return json({ error: "This link is not active.", reason: session.reason }, 401);
    }
    if (session.status !== "active") {
      return json(
        { error: "This one-time link has already been used.", reason: "spent" },
        401,
      );
    }
    const intake = parseCompletedIntake(body.intake);
    const choices = parseChoices(body.choices);
    const notes = parseNotes(body.notes);
    const declaredFiles = parseDeclaredFiles(body.files);
    const consent = body.consent === true;
    const started = await startBuyerJob({
      payload: session.payload,
      intake,
      notes,
      choices,
      consent,
      spentIds: spentIdsFromCookie(cookie),
      declaredFiles,
    });
    kick(request, token);
    const response = json({
      status: "preparing",
      done: started.done,
      total: started.total,
      emailed: false,
      linkStatus: session.payload.kind === "one-time" ? "spent" : "active",
    });
    if (session.payload.kind === "one-time") {
      response.cookies.set(
        SPENT_COOKIE,
        sealSpentCookie(cookie, session.grantId),
        spentCookieOptions(),
      );
    }
    return response;
  } catch (error) {
    return fail(error);
  }
}
