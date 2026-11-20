export const BUYER_AREAS = [
  "Reserves and funding",
  "Structural safety",
  "Special assessments",
  "Insurance",
  "Delinquencies",
  "Litigation",
  "Budget",
  "Rental and use",
  "Management and records",
] as const;

export type BuyerArea = (typeof BUYER_AREAS)[number];

export type Statute = "718" | "720";
export type Tri = "yes" | "no" | "unsure";
export type UsePlan = "live" | "rent" | "undecided";
export type Completer = "buyer" | "agent";
export type AnswerValue = "Yes" | "No" | "Partial" | "Unknown" | "N/A";

export type BuyerLogic =
  | "ALL"
  | "COA"
  | "HOA"
  | "SIRS"
  | "MILE"
  | "TALL"
  | "HOA_TALL";

export type AnswerPolarity = "good" | "bad";

export type BuyerQuestion = {
  id: string;
  area: BuyerArea;
  prompt: string;
  help: string;
  ask: string;
  polarity: AnswerPolarity;
  weight: number;
  critical: boolean;
  logic: BuyerLogic;
};

export type BuyerIntake = {
  completer: Completer;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  agentName: string;
  agentEmail: string;
  associationName: string;
  county: string;
  statute: Statute;
  unit: string;
  usePlan: UsePlan;
  stories3: Tri;
  yearBuilt: number | null;
  coastal: Tri | null;
  notes: string;
};

export type BuyerFacts = {
  statute: Statute;
  stories3: Tri;
  yearBuilt: number | null;
  coastal: Tri | null;
  usePlan: UsePlan;
};

/** Higher means more concern. Same bands as the board screening. */
export type BuyerBand = "Low" | "Moderate" | "Elevated" | "Critical";

export type GrantKind = "one-time" | "agent";
export type GrantStatus = "active" | "spent" | "revoked";
export type BillingMode = "manual" | "stripe";
export type BillingInterval = "one_time" | "month";

export type GrantBilling = {
  mode: BillingMode;
  priceUsd: number;
  interval: BillingInterval;
  /** Reserved for a later Stripe Checkout. Always null today. */
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCheckoutSessionId: string | null;
};

export type SlotChoice = "not-available" | "skipped" | "uploaded";

export type DocumentStatus = "received" | "not-available" | "skipped" | "missing";

/** Safe to pass into the browser. No signing payload and no storage keys. */
export type BuyerSessionView = {
  grantId: string;
  kind: GrantKind;
  status: "active" | "spent";
  agentName: string;
  agentEmail: string;
  agentLicense: string;
  overCap: boolean;
  monthlyCap: number | null;
  reportsThisMonth: number;
};
