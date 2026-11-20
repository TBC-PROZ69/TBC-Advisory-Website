import { site } from "@/lib/site";

export const UPLOAD_CONSENT =
  "I have the right to share these association documents with TBC Advisory for this Buyers Health Check. I understand the files are stored privately, are not published on the website, are used only to record what was received for this report, and are deleted when the report is produced. Any file still stored after 30 days is deleted automatically.";

export const BUYER_DISCLAIMER = `This Buyers Health Check is a screening summary. It is based only on the answers and document names supplied for this property. It is not legal advice, not financial advice, not an engineering opinion, and not an inspection. It is not a title search, not an estoppel certificate, and not a substitute for review by a Florida real estate attorney or another licensed professional. TBC Advisory is not a law firm, not an engineering firm, and not a property management company. Association finances, insurance, and rules can change before closing. Confirm anything that matters to the purchase, in writing, with the association or its manager. Contact ${site.email}.`;

export const SCORE_EXPLANATION =
  "Scores run from 0 to 100. A higher score means more concern. Unknown answers count closer to a problem than to a clean yes, because a missing fact is still a risk at closing. Green is lower concern. It is not a pass, and it is not a promise that the association is healthy.";

export const STANDING_QUESTIONS = [
  "Ask the manager for a current estoppel and read the date it expires before you schedule closing.",
  "Ask whether the board expects to approve any special assessment, loan, or reserve change before you close, and who must pay it.",
  "Ask for the master policy deductibles, especially wind or hurricane, and whether that deductible can be assessed to owners.",
  "Ask for the reserve balance, the study it is measured against, and whether any reserve category is waived.",
  "If you plan to lease the property, ask whether a rental cap has room, the minimum lease term, and the approval period.",
] as const;

export const BAND_META = {
  Low: {
    light: "Green",
    label: "Lower concern",
    swatch: "#146c43",
    surface: "#e7f6ee",
  },
  Moderate: {
    light: "Yellow",
    label: "Worth a closer look",
    swatch: "#8a5b00",
    surface: "#fff6db",
  },
  Elevated: {
    light: "Orange",
    label: "Material concern",
    swatch: "#9a3412",
    surface: "#fff1e6",
  },
  Critical: {
    light: "Red",
    label: "High concern",
    swatch: "#9b2c2c",
    surface: "#fde8e8",
  },
} as const;
