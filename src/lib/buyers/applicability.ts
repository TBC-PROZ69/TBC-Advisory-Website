import type { Tri } from "@/lib/buyers/types";

export function storiesLabel(value: Tri) {
  if (value === "yes") return "3 or more";
  if (value === "no") return "Under 3";
  return "Not sure";
}
