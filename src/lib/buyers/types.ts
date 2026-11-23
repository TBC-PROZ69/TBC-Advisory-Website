export type Tri = "yes" | "no" | "unsure";
export type Completer = "buyer" | "agent";

export type BuyerIntake = {
  completer: Completer;
  name: string;
  email: string;
  associationName: string;
  unitAddress: string;
  state: string;
  stories3: Tri;
};

export type BuyerFacts = {
  stories3: Tri;
  state: string;
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

export type SlotChoice = "not-available" | "not-applicable" | "uploaded";

export type DocumentStatus = "received" | "not-available" | "not-applicable" | "missing";

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
