import type { IntakeData } from "@/lib/assessment/types";
import type { AnswerMap } from "@/lib/assessment/scoring";
import type { AssessmentQuestion } from "@/lib/assessment/types";
import {
  actionHorizonGroups,
  buildRoadmap,
  type RoadmapResult,
} from "@/lib/assessment/roadmap";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function scoreLabel(score: number) {
  return `${score.toFixed(1)}`;
}

export function roadmapSubject(intake: IntakeData, roadmap: RoadmapResult) {
  return `TBC roadmap — ${intake.associationName} — ${intake.associationType} — ${roadmap.overallBand}`;
}

export function roadmapPlainText(
  intake: IntakeData,
  questions: AssessmentQuestion[],
  answers: AnswerMap,
  itemNotes: Record<string, string>,
  roadmap: RoadmapResult,
) {
  const groups = actionHorizonGroups(roadmap.actions);
  const lines = [
    "TBC Advisory — operational screening roadmap",
    "Screening tool — not legal advice, not an engineering inspection. TBC Advisory is not a property management company.",
    "",
    "1. Snapshot",
    `Association: ${intake.associationName}`,
    `Type: ${intake.associationType}`,
    `County: ${intake.county}`,
    `Year built: ${intake.yearBuilt} (age ${roadmap.age} as of 2026)`,
    `Tallest habitable stories: ${intake.stories}`,
    `${intake.associationType === "HOA" ? "Parcels" : "Units"}: ${intake.units}`,
    `Any building 3+ habitable stories: ${intake.has3plus ? "Yes" : "No"}`,
    `Control: ${intake.control}`,
    `Submitter: ${intake.submitterName} (${intake.submitterRole})`,
    `Email: ${intake.submitterEmail}`,
    `Phone: ${intake.submitterPhone}`,
    `Overall: ${roadmap.overallBand} (${scoreLabel(roadmap.overallScore)})`,
    intake.notes ? `Notes: ${intake.notes}` : "",
    "",
    "2. Critical items",
  ];

  if (roadmap.critical.length === 0) {
    lines.push("None flagged.");
  } else {
    for (const question of roadmap.critical) {
      const answer = answers[question.id] || "Unknown";
      lines.push(
        `${question.id} [${answer}] ${question.question} Cite: ${question.cite} Action: resolve this item with the board using ${question.cite}.`,
      );
    }
  }

  lines.push("", "3. Domain scores");
  for (const domain of roadmap.domains) {
    lines.push(
      `${domain.domain}: ${scoreLabel(domain.score)} (${domain.band})`,
    );
  }

  lines.push("", "4. Prioritized actions");
  lines.push("30-day:");
  if (groups.d30.length === 0) lines.push("None.");
  for (const item of groups.d30) {
    lines.push(`- ${item.id} (${item.answer}) ${item.action}`);
  }
  lines.push("60-day:");
  if (groups.d60.length === 0) lines.push("None.");
  for (const item of groups.d60) {
    lines.push(`- ${item.id} (${item.answer}) ${item.action}`);
  }
  lines.push("90-day:");
  if (groups.d90.length === 0) lines.push("None.");
  for (const item of groups.d90) {
    lines.push(`- ${item.id} (${item.answer}) ${item.action}`);
  }

  lines.push("", "5. Full answer appendix");
  for (const question of questions) {
    const answer = answers[question.id] || "Unknown";
    const note = itemNotes[question.id]?.trim() || "";
    lines.push(
      `${question.id} | ${question.domain} | ${answer}${note ? ` | ${note}` : ""}`,
    );
  }

  lines.push(
    "",
    "Footer: screening tool — not legal advice, not an engineering inspection.",
  );

  return lines.filter((line) => line !== null).join("\n");
}

export function roadmapHtml(
  intake: IntakeData,
  questions: AssessmentQuestion[],
  answers: AnswerMap,
  itemNotes: Record<string, string>,
  roadmap: RoadmapResult,
) {
  const groups = actionHorizonGroups(roadmap.actions);
  const criticalRows =
    roadmap.critical.length === 0
      ? `<p>None flagged.</p>`
      : `<table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">${roadmap.critical
          .map((question) => {
            const answer = answers[question.id] || "Unknown";
            return `<tr>
              <td style="border-top:1px solid #d5dee6;vertical-align:top"><strong>${escapeHtml(question.id)}</strong><br/>${escapeHtml(answer)}</td>
              <td style="border-top:1px solid #d5dee6">${escapeHtml(question.question)}<br/><em>${escapeHtml(question.cite)}</em><br/>Board action: resolve this item using ${escapeHtml(question.cite)}.</td>
            </tr>`;
          })
          .join("")}</table>`;

  function actionList(items: typeof groups.d30) {
    if (items.length === 0) return "<p>None.</p>";
    return `<ul>${items
      .map(
        (item) =>
          `<li><strong>${escapeHtml(item.id)}</strong> (${escapeHtml(item.answer)}) — ${escapeHtml(item.action)}</li>`,
      )
      .join("")}</ul>`;
  }

  const domainRows = roadmap.domains
    .map(
      (domain) =>
        `<tr><td style="border-top:1px solid #d5dee6">${escapeHtml(domain.domain)}</td><td style="border-top:1px solid #d5dee6">${scoreLabel(domain.score)}</td><td style="border-top:1px solid #d5dee6">${escapeHtml(domain.band)}</td></tr>`,
    )
    .join("");

  const appendix = questions
    .map((question) => {
      const answer = answers[question.id] || "Unknown";
      const note = itemNotes[question.id]?.trim() || "";
      return `<tr>
        <td style="border-top:1px solid #d5dee6">${escapeHtml(question.id)}</td>
        <td style="border-top:1px solid #d5dee6">${escapeHtml(question.domain)}</td>
        <td style="border-top:1px solid #d5dee6">${escapeHtml(answer)}</td>
        <td style="border-top:1px solid #d5dee6">${escapeHtml(note)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;color:#111111;background:#f5f7fa;padding:24px">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;padding:28px;border:1px solid #d5dee6">
    <p style="letter-spacing:0.18em;text-transform:uppercase;color:#126bae;font-size:12px">TBC Advisory</p>
    <h1 style="font-size:28px;color:#111111">Operational screening roadmap</h1>
    <p>Screening tool — not legal advice, not an engineering inspection. TBC Advisory is not a property management company.</p>

    <h2 style="color:#111111">1. Snapshot</h2>
    <p>
      <strong>${escapeHtml(intake.associationName)}</strong><br/>
      Type: ${escapeHtml(intake.associationType)} · ${escapeHtml(intake.county)} County<br/>
      Year built: ${intake.yearBuilt} (age ${roadmap.age} as of 2026)<br/>
      Tallest habitable stories: ${intake.stories} · ${intake.associationType === "HOA" ? "Parcels" : "Units"}: ${intake.units}<br/>
      Any 3+ habitable-story building: ${intake.has3plus ? "Yes" : "No"}<br/>
      Control: ${escapeHtml(intake.control)}<br/>
      Submitter: ${escapeHtml(intake.submitterName)} (${escapeHtml(intake.submitterRole)}) · ${escapeHtml(intake.submitterEmail)} · ${escapeHtml(intake.submitterPhone)}<br/>
      Overall: <strong>${escapeHtml(roadmap.overallBand)}</strong> (${scoreLabel(roadmap.overallScore)})
    </p>
    ${intake.notes ? `<p>Notes: ${escapeHtml(intake.notes)}</p>` : ""}

    <h2 style="color:#111111">2. Critical items</h2>
    ${criticalRows}

    <h2 style="color:#111111">3. Domain scores</h2>
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">
      <tr><th align="left">Domain</th><th align="left">Score</th><th align="left">Band</th></tr>
      ${domainRows}
    </table>

    <h2 style="color:#111111">4. Prioritized 30 / 60 / 90-day actions</h2>
    <h3>30 days</h3>
    ${actionList(groups.d30)}
    <h3>60 days</h3>
    ${actionList(groups.d60)}
    <h3>90 days</h3>
    ${actionList(groups.d90)}

    <h2 style="color:#111111">5. Full answer appendix</h2>
    <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">
      <tr><th align="left">ID</th><th align="left">Domain</th><th align="left">Answer</th><th align="left">Notes</th></tr>
      ${appendix}
    </table>

    <p style="margin-top:32px;font-size:13px;color:#3c4956">Screening tool — not legal advice, not an engineering inspection.</p>
  </div>
</body></html>`;
}

export function buildRoadmapEmail(
  intake: IntakeData,
  questions: AssessmentQuestion[],
  answers: AnswerMap,
  itemNotes: Record<string, string>,
) {
  const roadmap = buildRoadmap(intake, questions, answers);
  return {
    roadmap,
    subject: roadmapSubject(intake, roadmap),
    text: roadmapPlainText(intake, questions, answers, itemNotes, roadmap),
    html: roadmapHtml(intake, questions, answers, itemNotes, roadmap),
  };
}
