import {
  BUYER_AREAS,
  type AnswerValue,
  type BuyerArea,
  type BuyerBand,
  type BuyerQuestion,
} from "@/lib/buyers/types";

export type AnswerMap = Record<string, AnswerValue | "">;

const GOOD = { Yes: 0, Partial: 0.5, Unknown: 0.75, No: 1 } as const;
const BAD = { Yes: 1, Partial: 0.5, Unknown: 0.75, No: 0 } as const;

export function roundScore(score: number) {
  return Math.round(score);
}

export function bandFor(score: number): BuyerBand {
  const rounded = roundScore(score);
  if (rounded >= 75) return "Critical";
  if (rounded >= 50) return "Elevated";
  if (rounded >= 25) return "Moderate";
  return "Low";
}

function factor(
  question: BuyerQuestion,
  answer: AnswerValue | "" | undefined,
  blanksAsUnknown: boolean,
): number | null {
  if (answer === "N/A") return null;
  const value = answer || (blanksAsUnknown ? "Unknown" : "");
  if (!value) return null;
  const table = question.polarity === "good" ? GOOD : BAD;
  return table[value as Exclude<AnswerValue, "N/A">];
}

export function scoreQuestions(
  questions: BuyerQuestion[],
  answers: AnswerMap,
  blanksAsUnknown: boolean,
) {
  let risk = 0;
  let weight = 0;
  for (const question of questions) {
    const value = factor(question, answers[question.id], blanksAsUnknown);
    if (value === null) continue;
    risk += value * question.weight;
    weight += question.weight;
  }
  if (weight === 0) return null;
  return (100 * risk) / weight;
}

export type FlagSeverity = "high" | "gap";

export function flagSeverity(
  question: BuyerQuestion,
  answer: AnswerValue | "" | undefined,
): FlagSeverity | null {
  if (!question.critical || answer === "N/A") return null;
  const value = answer || "Unknown";
  if (question.polarity === "good") {
    if (value === "Yes") return null;
    if (value === "No") return "high";
    return "gap";
  }
  if (value === "No") return null;
  if (value === "Yes") return "high";
  return "gap";
}

export function areaScores(
  questions: BuyerQuestion[],
  answers: AnswerMap,
  blanksAsUnknown: boolean,
) {
  return BUYER_AREAS.flatMap((area) => {
    const items = questions.filter((question) => question.area === area);
    if (items.length === 0) return [];
    const score = scoreQuestions(items, answers, blanksAsUnknown);
    if (score === null) return [];
    return [
      {
        area: area as BuyerArea,
        score,
        band: bandFor(score),
        count: items.length,
      },
    ];
  });
}
