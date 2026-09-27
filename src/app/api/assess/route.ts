import { NextResponse } from "next/server";

import {
  parseAssessPayload,
  processAssessment,
} from "@/lib/assessment/process";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const required = process.env.ASSESS_ACCESS_KEY;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  let payload;
  try {
    payload = parseAssessPayload(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid submission.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (required && payload.k !== required) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await processAssessment(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Assess submit failed", error);
    return NextResponse.json({ ok: true, warning: "record-partial" });
  }
}
