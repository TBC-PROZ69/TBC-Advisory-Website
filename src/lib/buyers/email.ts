import { BAND_META } from "@/lib/buyers/copy";
import { documentStatusLabel, type BuyerReport } from "@/lib/buyers/report";
import { CONTACT_INBOX, resendFromAddress } from "@/lib/mail";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buyerReportSubject(report: BuyerReport) {
  const band = BAND_META[report.overallBand].label;
  const place = report.unitAddress || report.stateName;
  return `Buyers Health Check: ${report.associationName}, ${place} (${band})`;
}

export function buyerReportText(report: BuyerReport) {
  const lines = [
    "TBC Advisory Buyers Health Check",
    report.disclaimer,
    "",
    `Reference: ${report.id}`,
    `Association: ${report.associationName}`,
    report.unitAddress ? `Unit address: ${report.unitAddress}` : "",
    `State: ${report.stateName}`,
    `Completed by: ${report.completer}, ${report.personName}`,
    `Email: ${report.personEmail}`,
    report.agentLine ? `Subscription agent: ${report.agentLine}` : "",
    `Residential building of 3 or more stories: ${report.stories3}`,
    "",
    report.summary,
    "",
    "Documents not in hand",
  ];
  if (report.findings.length === 0) lines.push("None.");
  for (const finding of report.findings) {
    lines.push(`${finding.title}: ${finding.text}`);
    if (finding.note) lines.push(`Note: ${finding.note}`);
  }
  lines.push("", "Documents to request before closing");
  if (report.requests.length === 0) lines.push("None. Every checklist item was attached.");
  for (const item of report.requests) lines.push(`- ${item.title}: ${item.ask}`);
  lines.push("", "Attached");
  for (const item of report.attachedNotes) {
    const names = item.files.join(", ");
    lines.push(`${item.title}${names ? ` (${names})` : ""}: ${item.text}`);
  }
  lines.push(
    "",
    "Uploaded files are deleted when the report is produced. This note lists names only.",
    "",
    report.disclaimer,
  );
  return lines.filter((line) => line !== "").join("\n");
}

export function buyerReportHtml(report: BuyerReport) {
  const meta = BAND_META[report.overallBand];
  const missing =
    report.findings.length === 0
      ? "<p>None.</p>"
      : `<ul>${report.findings
          .map(
            (finding) =>
              `<li><strong>${escapeHtml(finding.title)}</strong>: ${escapeHtml(finding.text)}</li>`,
          )
          .join("")}</ul>`;
  const requests =
    report.requests.length === 0
      ? "<p>None. Every checklist item was attached.</p>"
      : `<ul>${report.requests
          .map((item) => `<li>${escapeHtml(item.title)}: ${escapeHtml(item.ask)}</li>`)
          .join("")}</ul>`;
  const docs = report.documents
    .map((doc) => {
      const names = doc.files.map((file) => file.fileName).join(", ");
      return `<li>${escapeHtml(doc.title)}: ${escapeHtml(documentStatusLabel(doc.status))}${
        names ? ` (${escapeHtml(names)})` : ""
      }</li>`;
    })
    .join("");
  return `<div style="font-family:Georgia,serif;color:#111111">
    <p style="color:#126BAE;letter-spacing:0.12em;text-transform:uppercase;font-size:12px">TBC Advisory</p>
    <h1 style="font-size:24px">Buyers Health Check</h1>
    <p>${escapeHtml(report.associationName)}</p>
    <p style="color:${meta.swatch}">${escapeHtml(meta.light)}: ${escapeHtml(meta.label)}</p>
    <p>${escapeHtml(report.summary)}</p>
    ${report.agentLine ? `<p>Subscription agent: ${escapeHtml(report.agentLine)}</p>` : ""}
    <h2>Documents not in hand</h2>
    ${missing}
    <h2>Documents to request before closing</h2>
    ${requests}
    <h2>Checklist</h2>
    <ul>${docs}</ul>
    <p style="background:#f5f7fa;padding:12px">${escapeHtml(report.disclaimer)}</p>
  </div>`;
}

export async function sendBuyerReport(report: BuyerReport) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.error("Buyers report email skipped; Resend is not configured.");
    return false;
  }
  const to =
    process.env.BUYERS_NOTIFY_EMAIL?.trim() ||
    process.env.ASSESS_NOTIFY_EMAIL?.trim() ||
    CONTACT_INBOX;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    const result = await resend.emails.send({
      from: resendFromAddress(),
      to: [to],
      replyTo: report.personEmail,
      subject: buyerReportSubject(report),
      html: buyerReportHtml(report),
      text: buyerReportText(report),
    });
    if (result.error) {
      console.error("Buyers report email failed");
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      "Buyers report email failed",
      error instanceof Error ? error.name : "error",
    );
    return false;
  }
}
