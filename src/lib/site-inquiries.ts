import { escapeHtml, isValidEmail, trimField } from "@/lib/forms";

export const FIELD_LIMITS = {
  name: 120,
  email: 200,
  phone: 40,
  community: 200,
  organization: 200,
  need: 120,
  message: 5000,
  honeypot: 200,
} as const;

export type ConsultFields = {
  name: string;
  email: string;
  phone: string;
  community: string;
  message: string;
};

export type PrintQuoteFields = {
  name: string;
  email: string;
  phone: string;
  organization: string;
  need: string;
  message: string;
};

export type InquiryParseResult<T> =
  | { ok: true; honeypot: true }
  | { ok: true; honeypot: false; fields: T }
  | { ok: false; error: string };

function readRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }
  return body as Record<string, unknown>;
}

export function parseConsultInquiry(
  body: unknown,
): InquiryParseResult<ConsultFields> {
  const raw = readRecord(body);
  if (trimField(raw.hp_trap, FIELD_LIMITS.honeypot)) {
    return { ok: true, honeypot: true };
  }

  const fields: ConsultFields = {
    name: trimField(raw.name, FIELD_LIMITS.name),
    email: trimField(raw.email, FIELD_LIMITS.email),
    phone: trimField(raw.phone, FIELD_LIMITS.phone),
    community: trimField(raw.community, FIELD_LIMITS.community),
    message: trimField(raw.message, FIELD_LIMITS.message),
  };

  if (!fields.name) return { ok: false, error: "Please enter your name." };
  if (!fields.email) return { ok: false, error: "Please enter your email." };
  if (!isValidEmail(fields.email)) {
    return { ok: false, error: "That email does not look complete." };
  }
  if (!fields.community) {
    return { ok: false, error: "Please name the community or association." };
  }
  if (!fields.message) {
    return { ok: false, error: "Please tell us what the board is facing." };
  }

  return { ok: true, honeypot: false, fields };
}

export function parsePrintQuoteInquiry(
  body: unknown,
): InquiryParseResult<PrintQuoteFields> {
  const raw = readRecord(body);
  if (trimField(raw.hp_trap, FIELD_LIMITS.honeypot)) {
    return { ok: true, honeypot: true };
  }

  const fields: PrintQuoteFields = {
    name: trimField(raw.name, FIELD_LIMITS.name),
    email: trimField(raw.email, FIELD_LIMITS.email),
    phone: trimField(raw.phone, FIELD_LIMITS.phone),
    organization: trimField(raw.organization, FIELD_LIMITS.organization),
    need: trimField(raw.need, FIELD_LIMITS.need),
    message: trimField(raw.message, FIELD_LIMITS.message),
  };

  if (!fields.name) return { ok: false, error: "Please enter your name." };
  if (!fields.email) return { ok: false, error: "Please enter your email." };
  if (!isValidEmail(fields.email)) {
    return { ok: false, error: "That email does not look complete." };
  }
  if (!fields.organization) {
    return {
      ok: false,
      error: "Please name the community or organization.",
    };
  }
  if (!fields.need) {
    return { ok: false, error: "Please choose what you need printed." };
  }
  if (!fields.message) {
    return {
      ok: false,
      error: "Please describe quantities, sizes, or deadlines.",
    };
  }

  return { ok: true, honeypot: false, fields };
}

function dl(rows: Array<[string, string]>) {
  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<p style="margin:0 0 8px"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value).replaceAll("\n", "<br/>")}</p>`,
    )
    .join("");
  return { text, htmlRows };
}

function wrapHtml(title: string, inner: string) {
  return `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;color:#111111;background:#f5f7fa;padding:24px">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;padding:28px;border:1px solid #d5dee6">
    <p style="letter-spacing:0.18em;text-transform:uppercase;color:#126bae;font-size:12px">TBC Advisory</p>
    <h1 style="font-size:24px;color:#111111">${escapeHtml(title)}</h1>
    ${inner}
    <p style="margin-top:28px;font-size:13px;color:#3c4956">Reply to this email to reach the visitor.</p>
  </div>
</body></html>`;
}

export function consultEmail(fields: ConsultFields) {
  const { text, htmlRows } = dl([
    ["Name", fields.name],
    ["Email", fields.email],
    ["Phone", fields.phone || "(not provided)"],
    ["Community or association", fields.community],
    ["What the board is facing", fields.message],
  ]);
  return {
    subject: `Free consultation request — ${fields.community}`,
    text,
    html: wrapHtml("Free consultation request", htmlRows),
    replyTo: fields.email,
  };
}

export function printQuoteEmail(fields: PrintQuoteFields) {
  const { text, htmlRows } = dl([
    ["Name", fields.name],
    ["Email", fields.email],
    ["Phone", fields.phone || "(not provided)"],
    ["Community or organization", fields.organization],
    ["Offering", fields.need],
    ["Notes", fields.message],
  ]);
  return {
    subject: `TBC Print quote request — ${fields.organization}`,
    text,
    html: wrapHtml("TBC Print quote request", htmlRows),
    replyTo: fields.email,
  };
}
