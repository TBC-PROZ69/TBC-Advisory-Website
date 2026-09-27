export const ASSESSMENT_YEAR = 2026;

export type AssociationType = "HOA" | "COA";

export type ControlStatus =
  | "Owner-controlled"
  | "Developer-controlled"
  | "Mixed or unknown";

export type SubmitterRole = "director" | "officer" | "manager" | "other";

export type AnswerValue = "Yes" | "No" | "Partial" | "Unknown" | "N/A";

export type QuestionLogic =
  | "BOTH"
  | "COA"
  | "HOA"
  | "COA10PLUS"
  | "WEB718"
  | "WEB720"
  | "HOA1000"
  | "SIRS"
  | "MILE"
  | "SIRS_OR_MILE";

export type AssessmentDomain =
  | "Governance"
  | "Records & Transparency"
  | "Financial/Reserves"
  | "SIRS & Structural"
  | "Milestone/Safety"
  | "Insurance"
  | "Contracts/Vendors"
  | "Maintenance"
  | "Elections/Owners"
  | "Litigation/Compliance";

export const DOMAIN_ORDER: AssessmentDomain[] = [
  "Governance",
  "Records & Transparency",
  "Financial/Reserves",
  "SIRS & Structural",
  "Milestone/Safety",
  "Insurance",
  "Contracts/Vendors",
  "Maintenance",
  "Elections/Owners",
  "Litigation/Compliance",
];

export type AssessmentQuestion = {
  id: string;
  domain: AssessmentDomain;
  question: string;
  appliesLabel: string;
  cite: string;
  weight: number;
  critical: boolean;
  logic: QuestionLogic;
};

export type IntakeData = {
  associationName: string;
  associationType: AssociationType;
  county: string;
  yearBuilt: number;
  stories: number;
  units: number;
  has3plus: boolean;
  control: ControlStatus;
  submitterName: string;
  submitterRole: SubmitterRole;
  submitterEmail: string;
  submitterPhone: string;
  notes: string;
};

export type ApplicabilityFacts = {
  type: AssociationType;
  stories: number;
  units: number;
  yearBuilt: number;
  has3plus: boolean;
};

export type RiskBand = "Critical" | "Elevated" | "Moderate" | "Low";
