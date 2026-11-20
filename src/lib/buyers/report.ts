import {
  factsFromIntake,
  statuteLabel,
  structuralNotes,
  plannedUseLabel,
  triLabel,
} from "@/lib/buyers/applicability";
import {
  BUYER_DISCLAIMER,
  SCORE_EXPLANATION,
  STANDING_QUESTIONS,
} from "@/lib/buyers/copy";
import { documentRows, type PublicFile } from "@/lib/buyers/documents";
import {
  areaScores,
  bandFor,
  flagSeverity,
  roundScore,
  scoreQuestions,
  type AnswerMap,
} from "@/lib/buyers/scoring";
import type {
  BuyerArea,
  BuyerBand,
  BuyerIntake,
  BuyerQuestion,
  DocumentStatus,
  GrantKind,
  SlotChoice,
} from "@/lib/buyers/types";

const AREA_SUMMARY: Record<BuyerArea, Record<BuyerBand, string>> = {
  "Reserves and funding": {
    Low: "Reserve answers do not show a funding gap. Ask for the current balance anyway.",
    Moderate:
      "Reserve funding is only partly clear. Get the study and the current balance before you close.",
    Elevated:
      "Reserve funding looks thin or incomplete. Price the gap before you rely on the dues you were quoted.",
    Critical:
      "Reserves are waived, unfunded, or unknown. That can become a special assessment after you own the unit.",
  },
  "Structural safety": {
    Low: "Structural answers do not show an open safety problem. Confirm you have the report itself, not only a listing summary.",
    Moderate:
      "The structural record is incomplete. Ask whether a milestone inspection or SIRS applies, and request the report.",
    Elevated:
      "There is a structural finding, an unfinished repair, or a missing study that can affect cost and safety.",
    Critical:
      "A required structural study or inspection is missing, failed, or shows unfinished repairs. Do not treat the building as clear on this record.",
  },
  "Special assessments": {
    Low: "No special assessment shows in the answers. Ask the manager to confirm that on the estoppel.",
    Moderate:
      "Special assessment history is incomplete. Ask what was levied in the last three years and what is still unpaid.",
    Elevated:
      "A special assessment is in discussion or has been used recently. Find out who must pay it at closing.",
    Critical:
      "An approved special assessment is unpaid, or you do not know. The estoppel should state the amount and who pays it.",
  },
  Insurance: {
    Low: "Insurance answers do not show a coverage crisis. Still read the deductible before you close.",
    Moderate:
      "Coverage is only partly documented. Ask for the declaration pages and the wind or hurricane deductible.",
    Elevated:
      "Premiums, renewals, or deductibles look unstable. A large deductible can be assessed to owners after a storm.",
    Critical:
      "Insurance documents are missing, or a large deductible can be billed to owners. Get the numbers in writing.",
  },
  Delinquencies: {
    Low: "Delinquency answers do not show a collection problem. Glance at the aging report if you have it.",
    Moderate:
      "Collection exposure is unclear. Ask what share of owners are behind and whether any units are in foreclosure.",
    Elevated:
      "A meaningful share of owners may be behind, or collections are already in motion.",
    Critical:
      "Delinquencies look high or unknown. Unpaid assessments can push dues and special assessments onto everyone else.",
  },
  Litigation: {
    Low: "No litigation shows in the answers. Ask the estoppel to confirm there are no pending suits.",
    Moderate:
      "The litigation picture is incomplete. Ask for a written list of pending and threatened claims.",
    Elevated:
      "There is a claim or a threatened claim. Ask whether insurance covers it and whether owners can be assessed.",
    Critical:
      "The association is in litigation, or you could not find out. Price the deductible and any uninsured exposure before you close.",
  },
  Budget: {
    Low: "The budget answers do not show a sharp jump or a one-time prop under the dues. Read the current budget once more.",
    Moderate:
      "The current budget is only partly reviewed. Ask what changed from last year and why.",
    Elevated:
      "Dues have jumped, or the budget depends on money that may not recur.",
    Critical:
      "The current budget was not reviewed, or the dues picture is not reliable. Do not underwrite the purchase on last year's fee alone.",
  },
  "Rental and use": {
    Low: "Use rules do not show a conflict with your plans. Read the declaration before you waive a review period.",
    Moderate:
      "Rental or use rules are only partly checked. Match them to how you will actually use the property.",
    Elevated:
      "A rule, cap, or pending amendment may limit how you use the property.",
    Critical:
      "You have not confirmed the rules, or a restriction conflicts with your plans. Resolve that before you close.",
  },
  "Management and records": {
    Low: "The key buyer records look accounted for. Check the estoppel expiration date before closing.",
    Moderate:
      "Some buyer records are still missing. Minutes, the estoppel, and the disclosure packet are the usual gaps.",
    Elevated: "Management looks unstable, or important records have not been read.",
    Critical:
      "The estoppel, the disclosure packet, or the minutes are missing. Those are the papers that usually surface assessments, lawsuits, and rules.",
  },
};

export type ReportDocument = {
  slot: string;
  title: string;
  status: DocumentStatus;
  files: { fileName: string; byteSize: number }[];
};

export type ReportFlag = {
  id: string;
  area: BuyerArea;
  severity: "high" | "gap";
  prompt: string;
  answer: string;
  note: string;
  ask: string;
};

export type BuyerReport = {
  id: string;
  createdAt: string;
  disclaimer: string;
  scoreExplanation: string;
  associationName: string;
  county: string;
  statuteLabel: string;
  unit: string;
  buyerName: string;
  buyerEmail: string;
  completer: string;
  agentLine: string | null;
  typedAgentLine: string | null;
  linkKind: GrantKind;
  overCap: boolean;
  monthlyCap: number | null;
  usePlan: string;
  yearBuilt: string;
  stories3: string;
  coastal: string;
  intakeNotes: string;
  overallScore: number | null;
  overallBand: BuyerBand | null;
  areas: {
    area: BuyerArea;
    score: number;
    band: BuyerBand;
    summary: string;
  }[];
  redFlags: ReportFlag[];
  questionsToAsk: string[];
  documents: ReportDocument[];
  structuralNotes: string[];
  answers: {
    id: string;
    area: BuyerArea;
    prompt: string;
    answer: string;
    note: string;
  }[];
};

export function buildBuyerReport(input: {
  id: string;
  createdAt: string;
  intake: BuyerIntake;
  questions: BuyerQuestion[];
  answers: AnswerMap;
  notes: Record<string, string>;
  files: PublicFile[];
  choices: Record<string, SlotChoice | "">;
  linkKind: GrantKind;
  subscriptionAgent: { name: string; license: string } | null;
  overCap: boolean;
  monthlyCap: number | null;
}): BuyerReport {
  const facts = factsFromIntake(input.intake);
  const score = scoreQuestions(input.questions, input.answers, true);
  const flags: ReportFlag[] = [];
  for (const question of input.questions) {
    const severity = flagSeverity(question, input.answers[question.id]);
    if (!severity) continue;
    flags.push({
      id: question.id,
      area: question.area,
      severity,
      prompt: question.prompt,
      answer: input.answers[question.id] || "Unknown",
      note: input.notes[question.id]?.trim() ?? "",
      ask: question.ask,
    });
  }
  flags.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  const asks: string[] = [...STANDING_QUESTIONS];
  for (const flag of flags) {
    if (!asks.includes(flag.ask)) asks.push(flag.ask);
  }

  const subscription = input.subscriptionAgent;
  const typedAgent =
    input.linkKind === "one-time" && input.intake.agentName
      ? input.intake.agentName
      : "";

  return {
    id: input.id,
    createdAt: input.createdAt,
    disclaimer: BUYER_DISCLAIMER,
    scoreExplanation: SCORE_EXPLANATION,
    associationName: input.intake.associationName,
    county: input.intake.county,
    statuteLabel: statuteLabel(input.intake.statute),
    unit: input.intake.unit,
    buyerName: input.intake.buyerName,
    buyerEmail: input.intake.buyerEmail,
    completer: input.intake.completer === "agent" ? "Real estate agent" : "Buyer",
    agentLine: subscription
      ? `${subscription.name}, Florida real estate license ${subscription.license}`
      : null,
    typedAgentLine: typedAgent
      ? `${typedAgent}. This name was typed on a one-time link. It is not a verified subscription.`
      : null,
    linkKind: input.linkKind,
    overCap: input.overCap,
    monthlyCap: input.monthlyCap,
    usePlan: plannedUseLabel(input.intake.usePlan),
    yearBuilt: input.intake.yearBuilt ? String(input.intake.yearBuilt) : "Not provided",
    stories3: triLabel(input.intake.stories3),
    coastal: triLabel(input.intake.coastal),
    intakeNotes: input.intake.notes,
    overallScore: score === null ? null : roundScore(score),
    overallBand: score === null ? null : bandFor(score),
    areas: areaScores(input.questions, input.answers, true).map((area) => ({
      area: area.area,
      score: roundScore(area.score),
      band: area.band,
      summary: AREA_SUMMARY[area.area][area.band],
    })),
    redFlags: flags,
    questionsToAsk: asks.slice(0, 14),
    documents: documentRows(facts, input.files, input.choices),
    structuralNotes: structuralNotes(facts),
    answers: input.questions.map((question) => ({
      id: question.id,
      area: question.area,
      prompt: question.prompt,
      answer: input.answers[question.id] || "Unknown",
      note: input.notes[question.id]?.trim() ?? "",
    })),
  };
}

export function documentStatusLabel(status: DocumentStatus) {
  if (status === "received") return "Received";
  if (status === "not-available") return "Not available";
  if (status === "missing") return "Upload did not remain on file";
  return "Skipped";
}
