import { NextResponse, type NextRequest } from "next/server";

import { sweepStoredFiles } from "@/lib/buyers/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const agent = request.headers.get("user-agent") ?? "";
  const secret = process.env.CRON_SECRET?.trim();
  const bearer = request.headers.get("authorization") ?? "";
  const fromCron = agent.startsWith("vercel-cron/");
  const fromSecret = Boolean(secret) && bearer === `Bearer ${secret}`;
  if (!fromCron && !fromSecret) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const remaining = await sweepStoredFiles(new Date());
  return NextResponse.json(
    { ok: true, filesStillStored: remaining },
    { headers: { "Cache-Control": "no-store" } },
  );
}
