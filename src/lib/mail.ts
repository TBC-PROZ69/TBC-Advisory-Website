import { site } from "@/lib/site";

export const CONTACT_INBOX = site.email;

export const MAIL_NOT_CONFIGURED = "Email is not configured.";
export const MAIL_SEND_FAILED = "Email could not be sent.";

export function resendFromAddress() {
  return (
    process.env.RESEND_FROM?.trim() ||
    "TBC Advisory <notify@tbcadvisory.com>"
  );
}

export async function sendSiteEmail(opts: {
  subject: string;
  text: string;
  html: string;
  replyTo: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.error("RESEND_API_KEY missing; refusing to accept the submission.");
    return { ok: false, error: MAIL_NOT_CONFIGURED };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const result = await resend.emails.send({
      from: resendFromAddress(),
      to: [CONTACT_INBOX],
      replyTo: opts.replyTo,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (result.error) {
      console.error("Resend error", result.error);
      return { ok: false, error: MAIL_SEND_FAILED };
    }
    return { ok: true };
  } catch (error) {
    console.error("Resend send failed", error);
    return { ok: false, error: MAIL_SEND_FAILED };
  }
}
