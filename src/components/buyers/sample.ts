import { buyerQuestions } from "@/data/buyer-questions";
import type { IntakeDraft } from "@/lib/buyers/intake";
import type { AnswerValue } from "@/lib/buyers/types";

/** Fake data for a preview walkthrough. Not a real association or person. */
export const sampleIntake: IntakeDraft = {
  completer: "buyer",
  buyerName: "Sample Buyer",
  buyerEmail: "sample.buyer@example.com",
  buyerPhone: "555-0100",
  agentName: "Sample Agent",
  agentEmail: "sample.agent@example.com",
  associationName: "Palm Sample Condominium",
  county: "Sarasota",
  statute: "718",
  unit: "12B",
  usePlan: "live",
  stories3: "yes",
  yearBuilt: "1998",
  coastal: "yes",
  notes: "Sample only. No real association records are attached.",
};

const preset: Record<string, AnswerValue> = {
  "RES-01": "Yes",
  "RES-02": "No",
  "RES-03": "Unknown",
  "RES-04": "No",
  "RES-06": "Yes",
  "STR-01": "No",
  "STR-02": "Unknown",
  "STR-03": "No",
  "STR-04": "Unknown",
  "STR-05": "No",
  "SPL-01": "Yes",
  "SPL-02": "No",
  "SPL-03": "Yes",
  "SPL-04": "No",
  "INS-01": "Yes",
  "INS-02": "Yes",
  "INS-03": "No",
  "INS-04": "Partial",
  "INS-05": "Unknown",
  "DEL-01": "No",
  "DEL-02": "No",
  "DEL-03": "Yes",
  "LIT-01": "No",
  "LIT-02": "No",
  "LIT-03": "N/A",
  "BUD-01": "Yes",
  "BUD-02": "Yes",
  "BUD-03": "No",
  "BUD-04": "Yes",
  "USE-01": "Yes",
  "USE-02": "No",
  "USE-03": "No",
  "USE-04": "Yes",
  "MGT-01": "Yes",
  "MGT-02": "No",
  "MGT-03": "Unknown",
  "MGT-04": "No",
  "MGT-06": "No",
  "MGT-07": "Unknown",
};

export function sampleAnswers() {
  const answers: Record<string, AnswerValue> = {};
  for (const question of buyerQuestions) {
    const value = preset[question.id];
    if (value) answers[question.id] = value;
  }
  return answers;
}
