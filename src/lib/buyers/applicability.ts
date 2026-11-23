import type { BuyerFacts, Tri } from "@/lib/buyers/types";

/** SIRS and milestone rows show when a 3-story building is possible. */
export function structuralRowsApply(facts: BuyerFacts) {
  return facts.stories3 === "yes" || facts.stories3 === "unsure";
}

export function storiesLabel(value: Tri) {
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "Not sure";
}
