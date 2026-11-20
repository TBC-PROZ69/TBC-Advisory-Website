import { documentStatusLabel, type BuyerReport } from "@/lib/buyers/report";
import { CONTACT_INBOX, resendFromAddress } from "@/lib/mail";
import { BAND_META } from "@/lib/buyers/copy";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buyerReportSubject(report: BuyerReport) {
  const band = report.overallBand ?? "unscored";
  return `Buyers Health Check: ${report.associationName} unit ${report.unit} (${band})`;
}

export function buyerReportText(report: BuyerReport) {
  const lines = [
    "TBC Advisory Buyers Health Check",
    report.disclaimer,
    "",
    `Reference: ${report.id}`,
    `Prepared: ${report.createdAt}`,
    `Association: ${report.associationName}`,
    `County: ${report.county}`,
    `Type: ${report.statuteLabel}`,
    `Unit: ${report.unit}`,
    `Buyer: ${report.buyerName}`,
    `Buyer email: ${report.buyerEmail}`,
    `Completed by: ${report.completer}`,
    report.agentLine ? `Subscription agent: ${report.agentLine}` : "",
    report.typedAgentLine ? `Agent named on the form: ${report.typedAgentLine}` : "",
    `Use: ${report.usePlan}`,
    `Year built: ${report.yearBuilt}`,
    `Residential building of 3 or more stories: ${report.stories3}`,
    `Within 3 miles of the coast: ${report.coastal}`,
    report.overallScore === null
      ? "Overall: not scored"
      : `Overall: ${report.overallBand} (${report.overallScore})`,
    report.overCap
      ? `Courtesy volume: over the monthly cap of ${report.monthlyCap}.`
      : "",
    report.intakeNotes ? `Notes: ${report.intakeNotes}` : "",
    "",
    report.scoreExplanation,
    "",
    "Areas",
  ];
  for (const area of report.areas) {
    const meta = BAND_META[area.band];
    lines.push(
      `${area.area}: ${meta.light}, ${meta.label}, ${area.score}. ${area.summary}`,
    );
  }
  lines.push("", "Red flags");
  if (report.redFlags.length === 0) lines.push("None flagged.");
  for (const flag of report.redFlags) {
    lines.push(
      `${flag.severity === "high" ? "High" : "Gap"} ${flag.id} [${flag.answer}] ${flag.prompt}`,
    );
    if (flag.note) lines.push(`Note: ${flag.note}`);
    lines.push(`Ask: ${flag.ask}`);
  }
  lines.push("", "Questions to ask before closing");
  for (const question of report.questionsToAsk) lines.push(`- ${question}`);
  lines.push("", "Documents");
  lines.push(
    "File contents were not read. Names below are the record of what was received. Uploaded files are deleted when the report is produced.",
  );
  for (const doc of report.documents) {
    const names = doc.files.map((file) => file.fileName).join(", ");
    lines.push(
      `${doc.title}: ${documentStatusLabel(doc.status)}${names ? ` (${names})` : ""}`,
    );
  }
  for (const note of report.structuralNotes) lines.push(note);
  lines.push("", "Answers");
  for (const answer of report.answers) {
    lines.push(`${answer.id} | ${answer.area} | ${answer.answer}`);
    if (answer.note) lines.push(`Note: ${answer.note}`);
  }
  lines.push("", report.disclaimer);
  return lines.filter((line) => line !== "").join("\n");
}

export function buyerReportHtml(report: BuyerReport) {
  const areas = report.areas
    .map((area) => {
      const meta = BAND_META[area.band];
      return `<tr>
        <td style="border-top:1px solid #d5dee6;padding:8px">${escapeHtml(area.area)}</td>
        <td style="border-top:1px solid #d5dee6;padding:8px;color:${meta.swatch}">${escapeHtml(meta.light)}: ${escapeHtml(meta.label)}</td>
        <td style="border-top:1px solid #d5dee6;padding:8px">${area.score}</td>
      </tr>`;
    })
    .join("");
  const flags =
    report.redFlags.length === 0
      ? "<p>None flagged.</p>"
      : `<ul>${report.redFlags
          .map(
            (flag) =>
              `<li><strong>${escapeHtml(flag.severity === "high" ? "High" : "Gap")}</strong> ${escapeHtml(flag.id)} (${escapeHtml(flag.answer)}): ${escapeHtml(flag.prompt)}</li>`,
          )
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
    <p>${escapeHtml(report.associationName)}, unit ${escapeHtml(report.unit)}</p>
    <p>${escapeHtml(report.statuteLabel)} · ${escapeHtml(report.county)} County</p>
    <p>Reference ${escapeHtml(report.id)}</p>
    ${
      report.agentLine
        ? `<p>Subscription agent: ${escapeHtml(report.agentLine)}</p>`
        : ""
    }
    <p style="background:#f5f7fa;padding:12px">${escapeHtml(report.disclaimer)}</p>
    <h2>Areas</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${areas}</table>
    <h2>Red flags</h2>
    ${flags}
    <h2>Documents</h2>
    <ul>${docs}</ul>
    <p>Uploaded files are deleted when the report is produced. This email lists names only.</p>
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
      replyTo: report.buyerEmail,
      subject: buyerReportSubject(report),
      html: buyerReportHtml(report),
      text: buyerReportText(report),
    });
    if (result.error) {
      console.error("Buyers report email failed", result.error.name ?? "error");
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
