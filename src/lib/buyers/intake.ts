import { MAX_NAME_CHARS } from "@/lib/buyers/constants";
import type { BuyerIntake, Completer, Tri } from "@/lib/buyers/types";

export type LinkContext = {
  kind: "one-time" | "agent";
  agentName: string;
  agentEmail: string;
  agentLicense: string;
};

export const STATE_OPTIONS = [
  ["FL", "Florida"],
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

const STATE_CODES = new Set<string>(STATE_OPTIONS.map(([code]) => code));

export function stateName(code: string) {
  return STATE_OPTIONS.find(([value]) => value === code)?.[1] ?? code;
}

export type IntakeDraft = {
  completer: Completer | "";
  name: string;
  email: string;
  associationName: string;
  unitAddress: string;
  state: string;
  stories3: Tri | "";
};

export function emptyIntake(): IntakeDraft {
  return {
    completer: "",
    name: "",
    email: "",
    associationName: "",
    unitAddress: "",
    state: "FL",
    stories3: "",
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string) {
  return value.length <= 120 && EMAIL.test(value);
}

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function intakeIssues(draft: IntakeDraft) {
  const issues: Record<string, string> = {};
  if (draft.completer !== "buyer" && draft.completer !== "agent") {
    issues.completer = "Select buyer or agent.";
  }
  if (!clean(draft.name, MAX_NAME_CHARS)) issues.name = "Required.";
  if (!looksLikeEmail(draft.email.trim())) issues.email = "Enter a valid email.";
  if (!clean(draft.associationName, 160)) issues.associationName = "Required.";
  if (draft.unitAddress.trim().length > 160) {
    issues.unitAddress = "Use 160 characters or fewer.";
  }
  if (!STATE_CODES.has(draft.state)) issues.state = "Select a state.";
  if (draft.stories3 !== "yes" && draft.stories3 !== "no" && draft.stories3 !== "unsure") {
    issues.stories3 = "Select yes, no, or not sure.";
  }
  return issues;
}

export function toIntake(draft: IntakeDraft): BuyerIntake {
  if (Object.keys(intakeIssues(draft)).length > 0) {
    throw new Error("Intake is incomplete.");
  }
  return {
    completer: draft.completer as Completer,
    name: clean(draft.name, MAX_NAME_CHARS),
    email: draft.email.trim().toLowerCase(),
    associationName: clean(draft.associationName, 160),
    unitAddress: clean(draft.unitAddress, 160),
    state: draft.state,
    stories3: draft.stories3 as Tri,
  };
}
