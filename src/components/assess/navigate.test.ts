import { describe, expect, it } from "vitest";

import {
  goToNextDomain,
  goToPreviousDomain,
  withItemNote,
} from "@/components/assess/navigate";
import { emptyDraft, type AssessDraft } from "@/components/assess/storage";

function questionsDraft(domainIndex: number): AssessDraft {
  return { ...emptyDraft(), step: "questions", domainIndex };
}

describe("domain navigation", () => {
  it("advances to the next domain", () => {
    expect(goToNextDomain(questionsDraft(0), 10).domainIndex).toBe(1);
    expect(goToNextDomain(questionsDraft(0), 10).step).toBe("questions");
  });

  it("moves from the last domain to review", () => {
    const next = goToNextDomain(questionsDraft(9), 10);
    expect(next.step).toBe("review");
    expect(next.domainIndex).toBe(9);
  });

  it("steps back a domain and returns to intake from the first", () => {
    expect(goToPreviousDomain(questionsDraft(2)).domainIndex).toBe(1);
    expect(goToPreviousDomain(questionsDraft(0)).step).toBe("intake");
  });

  it("keeps a note written after Next from rewinding the domain", () => {
    const advanced = goToNextDomain(questionsDraft(1), 10);
    const noted = withItemNote(advanced, "REC-01", "minutes missing");
    expect(advanced.domainIndex).toBe(2);
    expect(noted.domainIndex).toBe(2);
    expect(noted.itemNotes["REC-01"]).toBe("minutes missing");
  });

  it("normalizes a corrupt domain index instead of getting stuck", () => {
    const broken = questionsDraft(Number.NaN);
    expect(goToNextDomain(broken, 4).domainIndex).toBe(1);
    expect(goToPreviousDomain(broken).step).toBe("intake");
  });
});
