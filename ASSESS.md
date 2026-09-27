# Hidden association assessment

Unlisted screening at `/assess` (also `/assess/`). It is **not** linked from the public header, footer, sitemap, or navigation. Pages send `noindex,nofollow` and `X-Robots-Tag: noindex, nofollow`.

This is a board screening tool. It is not legal advice and not an engineering inspection. TBC Advisory is not a property management company. Chapter 719 cooperatives are out of scope (HOA Ch. 720 and COA Ch. 718 only).

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | No for `/assess` | If missing, assess submit still returns 200; the roadmap is generated and persisted, and email is skipped (logged). **Required** for the public `/contact` consult form (that route fails closed). |
| `ASSESS_ACCESS_KEY` | No | If set, `/assess?k=` must match or the route 404s. The same value is posted as `k` on submit. If unset, the URL is enough. |
| `ASSESS_NOTIFY_EMAIL` | No | Defaults to `info@tbcadvisory.com` (Steve). |
| `RESEND_FROM` | No | Defaults to `TBC Advisory assess <notify@tbcadvisory.com>`. Use Resend's default from-address if that domain is not verified. |

From address reply-to is the submitter email.

## Scoring (email only)

The board never sees scores. Email risk score = `100 * sum(factor × weight) / sum(weights)` over applicable items.

Factors: Yes 0, Partial 0.5, Unknown 0.75, No 1.0. N/A is excluded. Blanks score as Unknown in the email only.

Bands: ≥75 Critical, ≥50 Elevated, ≥25 Moderate, else Low.

Critical flags: `critical: true` items answered No, Unknown, or left blank.

SIRS-10 shows only when **both** SIRS and the Ch. 718 website threshold apply.

## Storage

Each submit writes JSON under `submissions/` when the filesystem allows, otherwise `/tmp/tbc-assess-submissions/`. The email body is always a complete record. `submissions/` is gitignored (PII). Optional Vercel Blob can be wired later with `BLOB_READ_WRITE_TOKEN`; the email remains the system of record if a blob store is not configured.
