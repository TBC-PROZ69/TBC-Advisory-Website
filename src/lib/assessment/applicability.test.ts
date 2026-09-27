import { describe, expect, it } from "vitest";

import { assessmentQuestions } from "@/data/assessment-questions";
import {
  applicableQuestions,
  questionApplies,
} from "@/lib/assessment/applicability";
import {
  criticalFlagItems,
  riskBand,
  scoreItems,
} from "@/lib/assessment/scoring";
import type { ApplicabilityFacts } from "@/lib/assessment/types";

const hoaLowRise: ApplicabilityFacts = {
  type: "HOA",
  stories: 2,
  units: 40,
  yearBuilt: 2000,
  has3plus: false,
};

const coaHighRise: ApplicabilityFacts = {
  type: "COA",
  stories: 12,
  units: 200,
  yearBuilt: 1986,
  has3plus: true,
};

function idsFor(facts: ApplicabilityFacts) {
  return new Set(applicableQuestions(facts).map((question) => question.id));
}

describe("question bank", () => {
  it("has 80 questions", () => {
    expect(assessmentQuestions).toHaveLength(80);
  });
});

describe("applicability — 2-story HOA, 40 parcels", () => {
  const ids = idsFor(hoaLowRise);

  it("hides SIRS, milestone, and condominium website questions", () => {
    expect(ids.has("SIRS-01")).toBe(false);
    expect(ids.has("SIRS-10")).toBe(false);
    expect(ids.has("MIL-01")).toBe(false);
    expect(ids.has("REC-03")).toBe(false);
    expect(ids.has("CON-06")).toBe(false);
    expect(
      [...ids].some(
        (id) => assessmentQuestions.find((q) => q.id === id)?.logic === "WEB718",
      ),
    ).toBe(false);
  });

  it("shows HOA questions and both-chapter questions", () => {
    expect(ids.has("GOV-01")).toBe(true);
    expect(ids.has("GOV-07")).toBe(true);
    expect(ids.has("FIN-06")).toBe(true);
    expect(ids.has("CON-03")).toBe(true);
    expect(ids.has("INS-06")).toBe(true);
    expect(ids.has("LIT-02")).toBe(true);
    expect(ids.has("WEB720") || ids.has("REC-04")).toBe(false);
  });

  it("does not show condominium-only items", () => {
    expect(ids.has("GOV-10")).toBe(false);
    expect(ids.has("FIN-14")).toBe(false);
    expect(ids.has("INS-01")).toBe(false);
  });
});

describe("applicability — 12-story COA, 200 units, age 40", () => {
  const ids = idsFor(coaHighRise);

  it("shows SIRS, milestone, and WEB718", () => {
    expect(ids.has("SIRS-01")).toBe(true);
    expect(ids.has("SIRS-10")).toBe(true);
    expect(ids.has("MIL-01")).toBe(true);
    expect(ids.has("REC-03")).toBe(true);
    expect(ids.has("CON-06")).toBe(true);
  });

  it("hides HOA-only questions", () => {
    expect(ids.has("GOV-07")).toBe(false);
    expect(ids.has("FIN-06")).toBe(false);
    expect(ids.has("FIN-10")).toBe(false);
    expect(ids.has("CON-03")).toBe(false);
    expect(ids.has("INS-06")).toBe(false);
    expect(ids.has("LIT-02")).toBe(false);
    expect(ids.has("REC-04")).toBe(false);
  });
});

describe("SIRS-10 requires SIRS and WEB718", () => {
  it("hides SIRS-10 when SIRS does not apply even if the website threshold is met", () => {
    const lowRiseLarge: ApplicabilityFacts = {
      type: "COA",
      stories: 2,
      units: 40,
      yearBuilt: 2000,
      has3plus: false,
    };
    expect(
      questionApplies(
        assessmentQuestions.find((q) => q.id === "SIRS-10")!,
        lowRiseLarge,
      ),
    ).toBe(false);
    expect(
      questionApplies(
        assessmentQuestions.find((q) => q.id === "REC-03")!,
        lowRiseLarge,
      ),
    ).toBe(true);
  });
});

describe("scoring", () => {
  it("flags GOV-01 as a critical item when answered No", () => {
    const gov01 = assessmentQuestions.find((q) => q.id === "GOV-01")!;
    const flags = criticalFlagItems([gov01], { "GOV-01": "No" });
    expect(flags.map((q) => q.id)).toEqual(["GOV-01"]);
  });

  it("treats blank as Unknown for email scoring and excludes N/A", () => {
    const gov01 = assessmentQuestions.find((q) => q.id === "GOV-01")!;
    const rec07 = assessmentQuestions.find((q) => q.id === "REC-07")!;
    const scored = scoreItems(
      [gov01, rec07],
      { "GOV-01": "No", "REC-07": "N/A" },
      true,
    );
    expect(scored).toBe(100);
    expect(riskBand(scored!)).toBe("Critical");
  });
});
