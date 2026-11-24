import { after, NextResponse, type NextRequest } from "next/server";

import { loadBuyerSession } from "@/lib/buyers/access";
import { sendBuyerReport } from "@/lib/buyers/email";
import { BuyersError } from "@/lib/buyers/errors";
import { advanceBuyerJob } from "@/lib/buyers/job";
import { markReportEmailed } from "@/lib/buyers/service";

export const runtime = "nodejs";
export const maxDuration = 300;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { t?: string } | null;
    const token = body?.t ?? "";
    if (token.length < 20) return json({ error: "This link is not valid." }, 401);
    const session = await loadBuyerSession(token);
    if (!session.ok) return json({ error: "This link is not active." }, 401);
    const result = await advanceBuyerJob(session.grantId);
    if (result.status === "preparing" && "more" in result && result.more) {
      const url = new URL("/api/buyers/report/work", request.url);
      after(() => {
        void fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ t: token }),
        });
      });
    }
    if ("report" in result && result.report) {
      const emailed = await sendBuyerReport(result.report);
      if (emailed) await markReportEmailed(result.report.id);
    }
    return json({ status: result.status, done: result.done, total: result.total });
  } catch (error) {
    if (error instanceof BuyersError) return json({ error: error.message }, error.status);
    console.error("Buyers work failed", error instanceof Error ? error.name : "error");
    return json({ error: "The report could not be prepared." }, 500);
  }
}
