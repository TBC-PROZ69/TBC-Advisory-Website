import { site } from "@/lib/site";

export const UPLOAD_CONSENT =
  "I have the right to share these association documents with TBC Advisory for this Buyers Health Check. I understand the files are stored privately, are not published on the website, are read only to prepare this report, and are deleted when the report is produced, whether it succeeds or not. An upload that is never submitted is deleted within 24 hours.";

export const BUYER_DISCLAIMER = `This Buyers Health Check is checklists and guidance. It quotes text and figures taken from the documents provided, and it records which documents were missing or marked Doesn't apply. It is not legal advice, not financial advice, not an engineering opinion, and not an inspection. It is not a title search, not an estoppel certificate, and not a substitute for review by a Florida real estate attorney or another licensed professional. TBC Advisory is not a law firm, not an engineering firm, and not a property management company. A scanned page may be unreadable. Association records can change before closing. Confirm anything that matters, in writing, with the association or its manager. Contact ${site.email}.`;

export const BAND_META = {
  Low: {
    light: "Green",
    label: "Records in hand",
    swatch: "#146c43",
    surface: "#e7f6ee",
  },
  Moderate: {
    light: "Yellow",
    label: "A few gaps",
    swatch: "#8a5b00",
    surface: "#fff6db",
  },
  Elevated: {
    light: "Orange",
    label: "Material gaps",
    swatch: "#9a3412",
    surface: "#fff1e6",
  },
  Critical: {
    light: "Red",
    label: "Important records missing",
    swatch: "#9b2c2c",
    surface: "#fde8e8",
  },
} as const;
