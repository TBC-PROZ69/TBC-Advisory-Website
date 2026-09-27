import {
  DOMAIN_ORDER,
  type AnswerValue,
  type AssessmentDomain,
  type AssessmentQuestion,
  type RiskBand,
} from "@/lib/assessment/types";

export const ANSWER_FACTORS: Record<Exclude<AnswerValue, "N/A">, number> = {
  Yes: 0,
  Partial: 0.5,
  Unknown: 0.75,
  No: 1,
};

export type AnswerMap = Record<string, AnswerValue | "">;

function scoringFactor(
  answer: AnswerValue | "" | undefined,
  blanksAsUnknown: boolean,
): number | null {
  if (answer === "N/A") return null;
  if (!answer) return blanksAsUnknown ? ANSWER_FACTORS.Unknown : null;
  return ANSWER_FACTORS[answer];
}

export function itemRisk(
  question: AssessmentQuestion,
  answer: AnswerValue | "" | undefined,
  blanksAsUnknown: boolean,
) {
  const factor = scoringFactor(answer, blanksAsUnknown);
  if (factor === null) return null;
  return factor * question.weight;
}

export function scoreItems(
  items: AssessmentQuestion[],
  answers: AnswerMap,
  blanksAsUnknown: boolean,
) {
  let risk = 0;
  let weight = 0;
  for (const question of items) {
    const value = itemRisk(question, answers[question.id], blanksAsUnknown);
    if (value === null) continue;
    risk += value;
    weight += question.weight;
  }
  if (weight === 0) return null;
  return (100 * risk) / weight;
}

export function riskBand(score: number): RiskBand {
  if (score >= 75) return "Critical";
  if (score >= 50) return "Elevated";
  if (score >= 25) return "Moderate";
  return "Low";
}

export function isCriticalFlagAnswer(answer: AnswerValue | "" | undefined) {
  return answer === "No" || answer === "Unknown" || !answer;
}

export function criticalFlagItems(
  items: AssessmentQuestion[],
  answers: AnswerMap,
) {
  return items.filter(
    (question) =>
      question.critical && isCriticalFlagAnswer(answers[question.id]),
  );
}

export function domainScores(
  items: AssessmentQuestion[],
  answers: AnswerMap,
  blanksAsUnknown: boolean,
) {
  return DOMAIN_ORDER.flatMap((domain) => {
    const domainItems = items.filter((question) => question.domain === domain);
    if (domainItems.length === 0) return [];
    const score = scoreItems(domainItems, answers, blanksAsUnknown);
    if (score === null) return [];
    return [
      {
        domain: domain as AssessmentDomain,
        score,
        band: riskBand(score),
        count: domainItems.length,
      },
    ];
  });
}
