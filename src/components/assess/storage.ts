import type {
  AssociationType,
  ControlStatus,
  SubmitterRole,
} from "@/lib/assessment/types";
import type { AnswerMap } from "@/lib/assessment/scoring";

export const ASSESS_STORAGE_KEY = "tbc-assess-v1";
const ASSESS_EVENT = "tbc-assess";

export type IntakeDraft = {
  associationName: string;
  associationType?: AssociationType;
  county: string;
  yearBuilt?: number;
  stories?: number;
  units?: number;
  has3plus: boolean | "";
  control?: ControlStatus;
  submitterName: string;
  submitterRole?: SubmitterRole;
  submitterEmail: string;
  submitterPhone: string;
  notes: string;
};

export type AssessDraft = {
  step: "intake" | "questions" | "review" | "done";
  domainIndex: number;
  intake: IntakeDraft;
  answers: AnswerMap;
  itemNotes: Record<string, string>;
};

export const emptyDraft = (): AssessDraft => ({
  step: "intake",
  domainIndex: 0,
  intake: {
    associationName: "",
    county: "",
    submitterName: "",
    submitterEmail: "",
    submitterPhone: "",
    notes: "",
    has3plus: "",
  },
  answers: {},
  itemNotes: {},
});

const SERVER_DRAFT = emptyDraft();

let snapshot: { raw: string | null; draft: AssessDraft } = {
  raw: null,
  draft: SERVER_DRAFT,
};

export function loadDraft(): AssessDraft {
  if (typeof window === "undefined") return SERVER_DRAFT;
  const raw = sessionStorage.getItem(ASSESS_STORAGE_KEY);
  if (snapshot.raw === raw) return snapshot.draft;
  if (!raw) {
    snapshot = { raw: null, draft: emptyDraft() };
    return snapshot.draft;
  }
  try {
    const parsed = JSON.parse(raw) as AssessDraft;
    snapshot = {
      raw,
      draft: {
        ...emptyDraft(),
        ...parsed,
        intake: { ...emptyDraft().intake, ...parsed.intake },
      },
    };
    return snapshot.draft;
  } catch {
    snapshot = { raw, draft: emptyDraft() };
    return snapshot.draft;
  }
}

export function saveDraft(draft: AssessDraft) {
  const raw = JSON.stringify(draft);
  sessionStorage.setItem(ASSESS_STORAGE_KEY, raw);
  snapshot = { raw, draft };
  window.dispatchEvent(new Event(ASSESS_EVENT));
}

export function clearDraft() {
  sessionStorage.removeItem(ASSESS_STORAGE_KEY);
  snapshot = { raw: null, draft: emptyDraft() };
  window.dispatchEvent(new Event(ASSESS_EVENT));
}

export function subscribeDraft(onChange: () => void) {
  window.addEventListener(ASSESS_EVENT, onChange);
  return () => window.removeEventListener(ASSESS_EVENT, onChange);
}

export function getServerDraft() {
  return SERVER_DRAFT;
}
