# Buyers Health Check

Unlisted screening at `/buyers?t=...`. It is not linked from the header, footer, sitemap, or navigation. Pages send `noindex, nofollow` and `X-Robots-Tag: noindex, nofollow`.

This is for a prospective Florida condominium (Chapter 718) or homeowners association (Chapter 720) buyer, or their real estate agent. Chapter 719 cooperatives are out of scope. It is not legal, financial, engineering, or inspection advice. TBC Advisory is not a property management company.

The board tool at `/assess` is unchanged.

The public marketing pages do not currently describe this product. Nothing on the public site links here.

## How to try it on a preview

Do not put keys in chat, email, or the repository.

1. Open the preview, then add `/buyers/admin` to the address.
2. If `BUYERS_ADMIN_KEY` is not set, that hidden page opens and says so. It is not production.
3. Create a one-time link. The full address is copied. Open it, use **Fill sample data** (preview and local only), walk through questions, then the document step, then the report.
4. Reload the one-time link in the same browser. It is spent.
5. Create an agent link with a fake name, a fake email, and a fake Florida license. The agent name is printed on the report. Deactivate it from the list and open the link again.

Sample data on the button is fictional (`Palm Sample Condominium`, `sample.buyer@example.com`).

## Two link types

| Link | Behavior | Planned price (not charged) |
| --- | --- | --- |
| One-time | One report, then the link is spent. Unused links expire after 90 days. | $150 |
| Agent subscription | Tied to the agent's name, email, and Florida license. Unlimited reports while active. Soft courtesy cap, default 25 reports per calendar month (America/New_York). Past the cap the report is still produced and marked. Deactivate to turn the link off. | $350 per month |

Billing mode is `manual`. Stripe customer, subscription, and checkout ids are stored as empty fields so a later checkout can fill them after payment. The admin API rejects any attempt to mark a link as paid by the browser. Do not add Stripe until you are ready to take payment.

## Documents

Each slot offers Upload, Not available, or Skip. The buyer confirms a consent line before any upload.

Allowed types: PDF, JPEG, PNG, WEBP, GIF, DOCX, XLSX. Checked on the server by extension, MIME, and file signature. 4 MB per file (under the platform request limit). 32 MB and 24 files for the whole packet. ZIP is rejected. Minutes allow 12 files so a year of meetings can be separate PDFs. Governing documents allow 4. Insurance declaration pages allow 4.

Slots:

- Governing documents (declaration, bylaws, rules)
- Current budget
- Reserve study
- SIRS, only when a condominium SIRS may apply
- Milestone inspection report, only when a milestone inspection may be due or the age is unknown
- Board minutes, last 12 months
- Insurance declaration pages
- Special assessment history and notices
- Estoppel certificate
- Year-end financial report
- Most recent interim financial statement (added because the year-end report is often old by closing)
- Pending litigation summary (a summary or the estoppel section, not a full court file)
- Resale disclosure or question-and-answer sheet

The report lists Received, Not available, or Skipped. It does not quote file contents. Bytes are deleted when the report is produced. A sweep on later visits deletes anything still stored after 30 days. Private Blob uploads also set a 30-day lifetime.

Files are never given a public URL. There is no download route.

## What is real on a preview, and what is not

| Piece | Preview with no new env vars | After you connect private storage |
| --- | --- | --- |
| Question flow, scoring, on-screen report, print | Real | Real |
| One-time and agent links | Real, signed with a temporary key that is in the source and is not a production secret | Real, signed with `BUYERS_LINK_SECRET` |
| One-time "already used" in the same browser | Real (httpOnly cookie), even if the server instance changes | Real, plus the ledger |
| Revoke, monthly cap, and saved reports across instances | Best effort on that instance's temporary disk only | Real, in the private Blob ledger |
| Uploaded file bytes | Real for that instance, deleted after the report | Real, private Blob, deleted after the report, 30-day TTL as a backstop |
| Email copy to info@tbcadvisory.com | Only if `RESEND_API_KEY` is already set. The buyer is not emailed. | Same |
| Stripe | Not connected | Not connected until you add it |

The buyer is not emailed, so an address typed into the form cannot be used as a mail relay. Reply-To on the TBC copy is the buyer email.

## Before production

Set these on the Vercel project for Production (and Preview, if you want the preview locked). Do not commit the values.

| Variable | Required in production | Purpose |
| --- | --- | --- |
| `BUYERS_ADMIN_KEY` | Yes | Opens `/buyers/admin?k=`. If it is missing in production, the admin page 404s. |
| `BUYERS_LINK_SECRET` | Yes | At least 16 characters. Signs links. If it is missing in production, links cannot be checked. |
| `BUYERS_STORAGE` | Yes, set to `blob` | Turns on the private store. Leave unset until the store exists. |
| `BLOB_STORE_ID` or `BLOB_READ_WRITE_TOKEN` | Yes, with the row above | Credential for a **private** Blob store. A public store is the wrong product. |
| `BUYERS_AGENT_MONTHLY_CAP` | No | Default 25. Whole number from 1 to 500. |
| `BUYERS_NOTIFY_EMAIL` | No | Defaults to `ASSESS_NOTIFY_EMAIL`, then `info@tbcadvisory.com`. |
| `RESEND_API_KEY` / `RESEND_FROM` | No for the on-screen report | Same pair the site already uses. If missing, the report still appears and email is skipped. |

Create the Blob store yourself in Vercel as a private store and connect it to this project. This repository does not provision it.

Redeploy after the variables are set. Preview links signed with the temporary key will not verify once `BUYERS_LINK_SECRET` is set.

Agent links do not calendar-expire. Deactivate them. The signed token carries a far technical expiry (10 years) so a leaked signing secret can be retired by rotating `BUYERS_LINK_SECRET`, which also invalidates outstanding links.
