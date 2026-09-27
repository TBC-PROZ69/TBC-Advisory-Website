import { assessmentQuestions } from "@/data/assessment-questions";
import {
  ASSESSMENT_YEAR,
  type ApplicabilityFacts,
  type AssessmentQuestion,
} from "@/lib/assessment/types";

export function associationAge(
  yearBuilt: number,
  year: number = ASSESSMENT_YEAR,
) {
  return year - yearBuilt;
}

export function sirsApplies(facts: ApplicabilityFacts) {
  return (
    facts.type === "COA" && facts.stories >= 3 && facts.has3plus !== false
  );
}

export function mileApplies(facts: ApplicabilityFacts) {
  const age = associationAge(facts.yearBuilt);
  return facts.type === "COA" && facts.stories >= 3 && age >= 25;
}

export function web718Applies(facts: ApplicabilityFacts) {
  return facts.type === "COA" && facts.units >= 25;
}

export function questionApplies(
  question: AssessmentQuestion,
  facts: ApplicabilityFacts,
) {
  if (question.id === "SIRS-10") {
    return sirsApplies(facts) && web718Applies(facts);
  }

  switch (question.logic) {
    case "BOTH":
      return true;
    case "COA":
      return facts.type === "COA";
    case "HOA":
      return facts.type === "HOA";
    case "COA10PLUS":
      return facts.type === "COA" && facts.units > 10;
    case "WEB718":
      return web718Applies(facts);
    case "WEB720":
      return facts.type === "HOA" && facts.units >= 100;
    case "HOA1000":
      return facts.type === "HOA" && facts.units >= 1000;
    case "SIRS":
      return sirsApplies(facts);
    case "MILE":
      return mileApplies(facts);
    case "SIRS_OR_MILE":
      return facts.type === "COA" && facts.stories >= 3;
    default: {
      const _exhaustive: never = question.logic;
      return _exhaustive;
    }
  }
}

export function applicableQuestions(facts: ApplicabilityFacts) {
  return assessmentQuestions.filter((question) =>
    questionApplies(question, facts),
  );
}
