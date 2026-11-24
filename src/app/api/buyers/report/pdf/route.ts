import { NextResponse, type NextRequest } from "next/server";

import { BuyersError } from "@/lib/buyers/errors";
import { buyersPdfFilename, parseReportForPdf, renderBuyerPdf } from "@/lib/buyers/pdf";
import { grantAccessRecord } from "@/lib/buyers/service";
import { verifyToken } from "@/lib/buyers/token";
import { allowRequest, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!allowRequest(`buyers-pdf:${clientIp(request)}`, 20, 15 * 60 * 1000)) {
      return json({ error: "Too many PDF requests. Wait a few minutes and try again." }, 429);
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const token = typeof body?.t === "string" ? body.t : "";
    if (token.length < 20 || token.length > 4000) {
      return json({ error: "This link is not valid." }, 401);
    }
    let payload: ReturnType<typeof verifyToken> = null;
    try {
      payload = verifyToken(token);
    } catch {
      return json({ error: "This link is not valid." }, 503);
    }
    if (!payload) return json({ error: "This link is not valid." }, 401);
    if (payload.exp * 1000 < Date.now()) {
      return json({ error: "This link has expired." }, 401);
    }
    try {
      const access = await grantAccessRecord(payload.id);
      if (access.grant?.status === "revoked") {
        return json({ error: "This link has been turned off." }, 401);
      }
      if (access.grant && Date.parse(access.grant.expiresAt) < Date.now()) {
        return json({ error: "This link has expired." }, 401);
      }
    } catch {
      // The signed link is enough when temporary storage is on another instance.
    }
    const report = parseReportForPdf(body?.report);
    const bytes = await renderBuyerPdf(report);
    const filename = buyersPdfFilename(report.associationName, report.createdAt);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    if (error instanceof BuyersError) return json({ error: error.message }, error.status);
    console.error("Buyers PDF failed", error instanceof Error ? error.name : "error");
    return json({ error: "The PDF could not be prepared." }, 500);
  }
}
