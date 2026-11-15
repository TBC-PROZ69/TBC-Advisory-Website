# TBC Advisory

Marketing site for [TBC Advisory](https://www.tbcadvisory.com): an independent consultancy for HOA and COA board members. TBC is **not** a property management company.

TBC Print (on `/print`) is HOA/COA on-property signage and tradeshow printing only.

## Local development

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

The app listens on [http://127.0.0.1:43147](http://127.0.0.1:43147).

```bash
npm run build
npm start
```

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Positioning, what TBC is and is not, board pain points, short process |
| `/how-we-work` | Discovery → assessment → operational roadmap → implementation support |
| `/for-boards` | Vendor oversight, communications, reserves, projects, PM accountability |
| `/about` | Founder & CEO story (no invented name or headshot) |
| `/print` | Signage and tradeshow print quote request |
| `/contact` | Free consultation form |

The free consultation form on `/contact` (and the print quote form on `/print`) POST to same-origin API routes and email **info@tbcadvisory.com** through Resend. They do not open a mail client.

## Email (Vercel)

Set these on the Vercel project that hosts this site. Names must match exactly.

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | **Yes** for `/contact` and `/print` | Resend API key. If it is missing, the form shows an on-page error and the submission is not dropped silently. |
| `RESEND_FROM` | No | From header. Defaults to `TBC Advisory <notify@tbcadvisory.com>`. Must be a sender/domain verified in Resend. Reply-To is the visitor’s email so the office can reply in the thread. |

Do not send from a personal mailbox. Do not change DNS or MX for this form—the public inbox remains `info@tbcadvisory.com`.

## Bot protection (consultation and print quote)

Both public forms keep an off-screen honeypot. A submission that fills it looks like a normal success and does not send a notification email. Submissions that arrive less than about three seconds after the form loads are rejected with an on-page message.

Cloudflare Turnstile stays off until both variables below are set. If either one is missing, the server logs a warning, the widget is not required, and the forms keep working with the honeypot. Adding the variables does not require a code change. Redeploy after setting them so the public site key is included in the build. The secret is read on the server when a form is submitted.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | Site key. Rendered in the browser. |
| `TURNSTILE_SECRET_KEY` | No | Secret key. Verifies the token with Cloudflare before any notification email is sent. |

Create a free widget in the [Cloudflare Turnstile dashboard](https://dash.cloudflare.com/?to=/:account/turnstile). Choose **Managed**. Add `www.tbcadvisory.com` (and any preview hostnames you want covered). Copy the site key and the secret key into the Vercel project’s environment variables.

A token that fails verification is rejected with a short on-page error. Nothing is emailed.

The hidden `/assess` tool uses the same `RESEND_API_KEY` / `RESEND_FROM` pair. Assess still records a submission if the key is missing; the public consult form does not.

## Design

White and cool gray (`#F5F7FA`), near-black text, and brand blue `#126BAE`. Header and footer use the locked TBC lockup (no ring). One H1 per page. No cookie banner.

## Domain

Canonical host is `https://www.tbcadvisory.com`. Apex and HTTP already redirect there in production.
