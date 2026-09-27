import { describe, expect, it } from "vitest";

import { statuteTrackLabel } from "@/lib/assessment/tracks";

describe("statute tracks", () => {
  it("labels condominiums as Chapter 718 and HOAs as Chapter 720", () => {
    expect(statuteTrackLabel("COA")).toBe("Chapter 718 · Condominium");
    expect(statuteTrackLabel("HOA")).toBe(
      "Chapter 720 · Homeowners’ association",
    );
  });

  it("does not define a Chapter 719 track", () => {
    const labels = [statuteTrackLabel("COA"), statuteTrackLabel("HOA")];
    expect(labels.join(" ")).not.toMatch(/719/);
  });
});
