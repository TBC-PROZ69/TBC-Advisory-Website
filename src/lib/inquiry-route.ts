import { NextResponse } from "next/server";

import { sendSiteEmail } from "@/lib/mail";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import {
  consultEmail,
  parseConsultInquiry,
  parsePrintQuoteInquiry,
  printQuoteEmail,
  type ConsultFields,
  type PrintQuoteFields,
} from "@/lib/site-inquiries";

const VISITOR_ERROR =
  "We could not send your request. Please try again in a moment.";

function wantsJson(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return (
    contentType.includes("application/json") ||
    accept.includes("application/json")
  );
}

async function readBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

function respond(
  request: Request,
  redirectTo: string,
  status: number,
  payload: { ok?: true; error?: string },
) {
  if (wantsJson(request)) {
    return NextResponse.json(payload, { status });
  }
  const url = new URL(redirectTo, request.url);
  if (payload.ok) url.searchParams.set("sent", "1");
  else url.searchParams.set("error", "1");
  return NextResponse.redirect(url, 303);
}

export async function handleSiteInquiry(
  request: Request,
  kind: "consult" | "print",
) {
  const redirectTo = kind === "consult" ? "/contact" : "/print";

  if (!allowRequest(`inquiry:${kind}:${clientIp(request)}`)) {
    return respond(request, redirectTo, 429, { error: VISITOR_ERROR });
  }

  let body: unknown;
  try {
    body = await readBody(request);
  } catch {
    return respond(request, redirectTo, 400, {
      error: "That request could not be read.",
    });
  }

  const parsed =
    kind === "consult"
      ? parseConsultInquiry(body)
      : parsePrintQuoteInquiry(body);

  if (!parsed.ok) {
    return respond(request, redirectTo, 400, { error: parsed.error });
  }

  if (parsed.honeypot) {
    return respond(request, redirectTo, 200, { ok: true });
  }

  const email =
    kind === "consult"
      ? consultEmail(parsed.fields as ConsultFields)
      : printQuoteEmail(parsed.fields as PrintQuoteFields);

  const sent = await sendSiteEmail(email);
  if (!sent.ok) {
    return respond(request, redirectTo, 503, { error: VISITOR_ERROR });
  }

  return respond(request, redirectTo, 200, { ok: true });
}
