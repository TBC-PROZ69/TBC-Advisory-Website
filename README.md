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

The hidden `/assess` tool uses the same `RESEND_API_KEY` / `RESEND_FROM` pair. Assess still records a submission if the key is missing; the public consult form does not.

## Design

Deep navy, warm off-white, and a single brass accent. One H1 per page. No cookie banner.

## Domain

Canonical host is `https://www.tbcadvisory.com`. Apex and HTTP already redirect there in production.
