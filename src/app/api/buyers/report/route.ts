import { NextResponse, type NextRequest } from "next/server";

import {
  loadBuyerSession,
  sealSpentCookie,
  SPENT_COOKIE,
  spentCookieOptions,
  spentIdsFromCookie,
} from "@/lib/buyers/access";
import { sendBuyerReport } from "@/lib/buyers/email";
import { BuyersError } from "@/lib/buyers/errors";
import {
  parseChoices,
  parseCompletedIntake,
  parseDeclaredFiles,
  parseNotes,
} from "@/lib/buyers/payload";
import {
  commitBuyerReport,
  latestReport,
  markReportEmailed,
} from "@/lib/buyers/service";
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

function tokenFrom(value: unknown) {
  if (typeof value !== "string" || value.length < 20 || value.length > 4000) {
    throw new BuyersError("This link is not valid.", 401, "invalid");
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    if (!allowRequest(`buyers-report-get:${clientIp(request)}`, 60, 15 * 60 * 1000)) {
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
    if (!found) return json({ error: "No report is stored for this link." }, 404);
    return json(found);
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
    const { report, kind } = await commitBuyerReport({
      payload: session.payload,
      intake,
      notes,
      choices,
      consent,
      spentIds: spentIdsFromCookie(cookie),
      declaredFiles,
    });
    const emailed = await sendBuyerReport(report);
    if (emailed) await markReportEmailed(report.id);
    const response = json({
      report,
      emailed,
      linkStatus: kind === "one-time" ? "spent" : "active",
    });
    if (kind === "one-time") {
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
