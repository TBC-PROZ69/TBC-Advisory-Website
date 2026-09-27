import type { AssociationType } from "@/lib/assessment/types";

/** Active statute for this screening. Chapter 719 cooperatives are out of scope. */
export function statuteTrackLabel(type: AssociationType) {
  switch (type) {
    case "COA":
      return "Chapter 718 · Condominium";
    case "HOA":
      return "Chapter 720 · Homeowners’ association";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
