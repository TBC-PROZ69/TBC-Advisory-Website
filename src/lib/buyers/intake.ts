import { FLORIDA_COUNTIES } from "@/lib/assessment/counties";
import { MAX_INTAKE_NOTES, MAX_NAME_CHARS } from "@/lib/buyers/constants";
import { ASSESSMENT_YEAR } from "@/lib/assessment/types";
import type {
  BuyerIntake,
  Completer,
  Statute,
  Tri,
  UsePlan,
} from "@/lib/buyers/types";

export type LinkContext = {
  kind: "one-time" | "agent";
  agentName: string;
  agentEmail: string;
  agentLicense: string;
};

export type IntakeDraft = {
  completer: Completer | "";
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  agentName: string;
  agentEmail: string;
  associationName: string;
  county: string;
  statute: Statute | "";
  unit: string;
  usePlan: UsePlan | "";
  stories3: Tri | "";
  yearBuilt: string;
  coastal: Tri | "";
  notes: string;
};

export function emptyIntake(): IntakeDraft {
  return {
    completer: "",
    buyerName: "",
    buyerEmail: "",
    buyerPhone: "",
    agentName: "",
    agentEmail: "",
    associationName: "",
    county: "",
    statute: "",
    unit: "",
    usePlan: "",
    stories3: "",
    yearBuilt: "",
    coastal: "",
    notes: "",
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string) {
  return value.length <= 120 && EMAIL.test(value);
}

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function intakeIssues(draft: IntakeDraft, link: LinkContext) {
  const issues: Record<string, string> = {};
  if (draft.completer !== "buyer" && draft.completer !== "agent") {
    issues.completer = "Select who is completing this.";
  }
  if (!clean(draft.buyerName, MAX_NAME_CHARS)) issues.buyerName = "Required.";
  if (!looksLikeEmail(draft.buyerEmail.trim())) {
    issues.buyerEmail = "Enter a valid email.";
  }
  if (draft.buyerPhone.trim().length > 40) {
    issues.buyerPhone = "Use 40 characters or fewer.";
  }
  const agentRequired = link.kind === "one-time" && draft.completer === "agent";
  if (agentRequired && !clean(draft.agentName, MAX_NAME_CHARS)) {
    issues.agentName = "Required when an agent completes a one-time link.";
  }
  if (draft.agentEmail.trim() && !looksLikeEmail(draft.agentEmail.trim())) {
    issues.agentEmail = "Enter a valid email or leave this blank.";
  }
  if (agentRequired && !looksLikeEmail(draft.agentEmail.trim())) {
    issues.agentEmail = "Required when an agent completes a one-time link.";
  }
  if (!clean(draft.associationName, 160)) {
    issues.associationName = "Required.";
  }
  if (!(FLORIDA_COUNTIES as readonly string[]).includes(draft.county)) {
    issues.county = "Select a Florida county.";
  }
  if (draft.statute !== "718" && draft.statute !== "720") {
    issues.statute = "Select condominium or HOA.";
  }
  if (!clean(draft.unit, 40)) issues.unit = "Required.";
  if (
    draft.usePlan !== "live" &&
    draft.usePlan !== "rent" &&
    draft.usePlan !== "undecided"
  ) {
    issues.usePlan = "Select how the property will be used.";
  }
  if (
    draft.stories3 !== "yes" &&
    draft.stories3 !== "no" &&
    draft.stories3 !== "unsure"
  ) {
    issues.stories3 = "Select yes, no, or not sure.";
  }
  const year = draft.yearBuilt.trim();
  if (year) {
    if (!/^\d{4}$/.test(year)) {
      issues.yearBuilt = "Use a 4-digit year, or leave it blank.";
    } else {
      const value = Number(year);
      if (value < 1900 || value > ASSESSMENT_YEAR) {
        issues.yearBuilt = `Use a year from 1900 to ${ASSESSMENT_YEAR}, or leave it blank.`;
      }
    }
  }
  const tall = draft.stories3 === "yes" || draft.stories3 === "unsure";
  if (tall && draft.coastal !== "yes" && draft.coastal !== "no" && draft.coastal !== "unsure") {
    issues.coastal = "Select yes, no, or not sure.";
  }
  if (draft.notes.trim().length > MAX_INTAKE_NOTES) {
    issues.notes = `Use ${MAX_INTAKE_NOTES} characters or fewer.`;
  }
  return issues;
}

export function toIntake(draft: IntakeDraft, link: LinkContext): BuyerIntake {
  const issues = intakeIssues(draft, link);
  if (Object.keys(issues).length > 0) {
    throw new Error("Intake is incomplete.");
  }
  const tall = draft.stories3 === "yes" || draft.stories3 === "unsure";
  const year = draft.yearBuilt.trim();
  return {
    completer: draft.completer as Completer,
    buyerName: clean(draft.buyerName, MAX_NAME_CHARS),
    buyerEmail: draft.buyerEmail.trim().toLowerCase(),
    buyerPhone: clean(draft.buyerPhone, 40),
    agentName:
      link.kind === "agent"
        ? clean(link.agentName, MAX_NAME_CHARS)
        : clean(draft.agentName, MAX_NAME_CHARS),
    agentEmail:
      link.kind === "agent" && link.agentEmail
        ? link.agentEmail.trim().toLowerCase()
        : draft.agentEmail.trim()
          ? draft.agentEmail.trim().toLowerCase()
          : "",
    associationName: clean(draft.associationName, 160),
    county: draft.county,
    statute: draft.statute as Statute,
    unit: clean(draft.unit, 40),
    usePlan: draft.usePlan as UsePlan,
    stories3: draft.stories3 as Tri,
    yearBuilt: year ? Number(year) : null,
    coastal: tall ? (draft.coastal as Tri) : null,
    notes: draft.notes.trim().slice(0, MAX_INTAKE_NOTES),
  };
}
