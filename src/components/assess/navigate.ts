import type { AssessDraft } from "@/components/assess/storage";
import type { AnswerValue } from "@/lib/assessment/types";

function domainIndexOf(draft: AssessDraft) {
  return Number.isInteger(draft.domainIndex) && draft.domainIndex >= 0
    ? draft.domainIndex
    : 0;
}

export function goToNextDomain(
  draft: AssessDraft,
  domainCount: number,
): AssessDraft {
  const domainIndex = domainIndexOf(draft);
  if (domainCount < 1 || domainIndex >= domainCount - 1) {
    return { ...draft, domainIndex, step: "review" };
  }
  return { ...draft, domainIndex: domainIndex + 1 };
}

export function goToPreviousDomain(draft: AssessDraft): AssessDraft {
  const domainIndex = domainIndexOf(draft);
  if (domainIndex <= 0) {
    return { ...draft, domainIndex: 0, step: "intake" };
  }
  return { ...draft, domainIndex: domainIndex - 1 };
}

export function withAnswer(
  draft: AssessDraft,
  id: string,
  answer: AnswerValue,
): AssessDraft {
  return {
    ...draft,
    answers: { ...draft.answers, [id]: answer },
  };
}

export function withItemNote(
  draft: AssessDraft,
  id: string,
  note: string,
): AssessDraft {
  return {
    ...draft,
    itemNotes: { ...draft.itemNotes, [id]: note },
  };
}
