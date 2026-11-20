import { buyerQuestions } from "@/data/buyer-questions";
import { ASSESSMENT_YEAR } from "@/lib/assessment/types";
import type {
  BuyerFacts,
  BuyerIntake,
  BuyerLogic,
  BuyerQuestion,
  Tri,
} from "@/lib/buyers/types";

export type MilestoneWindow = "not-applicable" | "not-due" | "due" | "unknown";

export function factsFromIntake(intake: BuyerIntake): BuyerFacts {
  return {
    statute: intake.statute,
    stories3: intake.stories3,
    yearBuilt: intake.yearBuilt,
    coastal: intake.coastal,
    usePlan: intake.usePlan,
  };
}

export function tallBuilding(facts: BuyerFacts) {
  return facts.stories3 === "yes" || facts.stories3 === "unsure";
}

/** SIRS is a Chapter 718 duty for condominium buildings of 3 or more stories. */
export function sirsApplies(facts: BuyerFacts) {
  return facts.statute === "718" && tallBuilding(facts);
}

export function milestoneWindow(facts: BuyerFacts): MilestoneWindow {
  if (facts.stories3 === "no") return "not-applicable";
  if (facts.yearBuilt == null) return "unknown";
  const age = ASSESSMENT_YEAR - facts.yearBuilt;
  if (age < 0 || age > 200) return "unknown";
  const coastNotRuledOut = facts.coastal !== "no";
  if (coastNotRuledOut && age >= 25) return "due";
  if (age >= 30) return "due";
  return "not-due";
}

/**
 * Milestone questions show when a 3-story residential building may be due
 * or the age is unknown. HOAs can answer N/A when the building is not a
 * condominium or cooperative building.
 */
export function milestoneApplies(facts: BuyerFacts) {
  if (!tallBuilding(facts)) return false;
  return milestoneWindow(facts) !== "not-due";
}

export function questionApplies(question: BuyerQuestion, facts: BuyerFacts) {
  switch (question.logic) {
    case "ALL":
      return true;
    case "COA":
      return facts.statute === "718";
    case "HOA":
      return facts.statute === "720";
    case "SIRS":
      return sirsApplies(facts);
    case "MILE":
      return milestoneApplies(facts);
    case "TALL":
      return tallBuilding(facts);
    case "HOA_TALL":
      return facts.statute === "720" && tallBuilding(facts);
    default: {
      const neverLogic: never = question.logic;
      return neverLogic;
    }
  }
}

export function applicableQuestions(facts: BuyerFacts) {
  return buyerQuestions.filter((question) => questionApplies(question, facts));
}

export function structuralNotes(facts: BuyerFacts): string[] {
  const notes: string[] = [];
  if (facts.stories3 === "no") {
    notes.push(
      "SIRS and milestone questions were left out because the form says no residential building has 3 or more habitable stories. If that is wrong, correct the form before you rely on this report.",
    );
    return notes;
  }
  if (facts.stories3 === "unsure") {
    notes.push(
      "Building height was marked not sure, so the structural questions are included. If the community has no residential building of 3 or more stories, those items can be set aside.",
    );
  }
  if (facts.statute === "720") {
    notes.push(
      "Milestone inspections and structural integrity reserve studies are generally aimed at condominium and cooperative buildings. This is a homeowners association, so confirm in writing whether any building it maintains is actually covered.",
    );
  }
  const window = milestoneWindow(facts);
  if (window === "not-due") {
    notes.push(
      `A milestone inspection does not appear to be due yet, based on a year built of ${facts.yearBuilt} and the coastline answer, measured in ${ASSESSMENT_YEAR}. Confirm the certificate of occupancy date. A condominium SIRS can still apply before a milestone inspection is due.`,
    );
  }
  if (window === "unknown" && facts.coastal !== "no") {
    notes.push(
      "Where the year built is unknown, or the building was not clearly inland, this screening uses the earlier 25-year milestone timing. That is a cautious reading, not a determination that an inspection is legally due.",
    );
  }
  return notes;
}

export function statuteLabel(statute: BuyerFacts["statute"]) {
  return statute === "718"
    ? "Condominium, Chapter 718"
    : "Homeowners association, Chapter 720";
}

export function triLabel(value: Tri | null) {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  if (value === "unsure") return "Not sure";
  return "Not provided";
}

export function plannedUseLabel(plan: BuyerFacts["usePlan"]) {
  if (plan === "live") return "Live in it";
  if (plan === "rent") return "Rent it";
  return "Not decided";
}

export const LOGIC_LABEL: Record<BuyerLogic, string> = {
  ALL: "Condo and HOA",
  COA: "Condominium",
  HOA: "HOA",
  SIRS: "SIRS may apply",
  MILE: "Milestone may apply",
  TALL: "Building of 3 or more stories",
  HOA_TALL: "HOA with a taller building",
};
