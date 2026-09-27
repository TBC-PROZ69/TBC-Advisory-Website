import { associationAge } from "@/lib/assessment/applicability";
import {
  criticalFlagItems,
  domainScores,
  riskBand,
  scoreItems,
} from "@/lib/assessment/scoring";
import type { AnswerMap } from "@/lib/assessment/scoring";
import type {
  AnswerValue,
  AssessmentQuestion,
  IntakeData,
  RiskBand,
} from "@/lib/assessment/types";

export type RoadmapAction = {
  horizon: 30 | 60 | 90;
  id: string;
  question: string;
  cite: string;
  answer: string;
  action: string;
};

export type RoadmapResult = {
  overallScore: number;
  overallBand: RiskBand;
  age: number;
  critical: AssessmentQuestion[];
  domains: ReturnType<typeof domainScores>;
  actions: RoadmapAction[];
};

function displayAnswer(raw: AnswerValue | "" | undefined) {
  if (!raw) return "Unknown";
  return raw;
}

function recommendedAction(question: AssessmentQuestion, answer: string) {
  return `Board action: resolve “${question.question}” The recorded answer is ${answer}. Work from ${question.cite}. Do not treat this screening as legal advice or an engineering inspection.`;
}

export function buildRoadmap(
  intake: IntakeData,
  questions: AssessmentQuestion[],
  answers: AnswerMap,
): RoadmapResult {
  const overallScore = scoreItems(questions, answers, true) ?? 0;
  const overallBand = riskBand(overallScore);
  const critical = criticalFlagItems(questions, answers);
  const domains = domainScores(questions, answers, true);
  const age = associationAge(intake.yearBuilt);

  const actions: RoadmapAction[] = [];
  const used = new Set<string>();

  function push(
    horizon: 30 | 60 | 90,
    question: AssessmentQuestion,
    answer: string,
  ) {
    if (used.has(question.id)) return;
    used.add(question.id);
    actions.push({
      horizon,
      id: question.id,
      question: question.question,
      cite: question.cite,
      answer,
      action: recommendedAction(question, answer),
    });
  }

  for (const question of critical) {
    push(30, question, displayAnswer(answers[question.id]));
  }

  for (const question of questions) {
    const raw = answers[question.id];
    if (raw === "Yes" || raw === "N/A") continue;
    if (raw === "No") push(60, question, "No");
  }

  for (const question of questions) {
    const raw = answers[question.id];
    if (raw === "Partial") push(90, question, "Partial");
    if (!raw || raw === "Unknown") {
      if (!question.critical) push(90, question, "Unknown");
    }
  }

  return {
    overallScore,
    overallBand,
    age,
    critical,
    domains,
    actions,
  };
}

export function actionHorizonGroups(actions: RoadmapAction[]) {
  return {
    d30: actions.filter((item) => item.horizon === 30),
    d60: actions.filter((item) => item.horizon === 60),
    d90: actions.filter((item) => item.horizon === 90),
  };
}
