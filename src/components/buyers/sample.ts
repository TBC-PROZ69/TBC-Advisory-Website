import type { IntakeDraft } from "@/lib/buyers/intake";

/** Fake data for a preview walkthrough. Not a real association or person. */
export const sampleIntake: IntakeDraft = {
  completer: "buyer",
  name: "Sample Buyer",
  email: "sample.buyer@example.com",
  associationName: "Palm Sample Condominium",
  unitAddress: "12B Sample Way, Sarasota, FL",
  state: "FL",
  stories3: "yes",
};
