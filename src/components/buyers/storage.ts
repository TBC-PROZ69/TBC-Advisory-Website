import { emptyIntake, type IntakeDraft } from "@/lib/buyers/intake";
import type { BuyerReport } from "@/lib/buyers/report";
export type StoredFile = {
  id: string;
  fileName: string;
  byteSize: number;
};

export type BuyerDraft = {
  step: "intake" | "checklist" | "results";
  intake: IntakeDraft;
  notes: Record<string, string>;
  consent: boolean;
  missing: Record<string, boolean>;
  files: Record<string, StoredFile[]>;
};

export type StoredResult = {
  report: BuyerReport;
  emailed: boolean;
  linkStatus: "active" | "spent";
};

const EVENT = "tbc-buyers";

export function emptyDraft(): BuyerDraft {
  return {
    step: "intake",
    intake: emptyIntake(),
    notes: {},
    consent: false,
    missing: {},
    files: {},
  };
}

const SERVER_DRAFT = emptyDraft();

type DraftCache = { raw: string | null; draft: BuyerDraft };
type ResultCache = { raw: string | null; result: StoredResult | null };

const drafts = new Map<string, DraftCache>();
const results = new Map<string, ResultCache>();

function draftKey(grantId: string) {
  return `tbc-buyers-draft:${grantId}`;
}

function resultKey(grantId: string) {
  return `tbc-buyers-result:${grantId}`;
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeBuyers(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function getServerDraft() {
  return SERVER_DRAFT;
}

export function getServerResult(): StoredResult | null {
  return null;
}

export function loadDraft(grantId: string): BuyerDraft {
  if (typeof window === "undefined") return SERVER_DRAFT;
  const raw = sessionStorage.getItem(draftKey(grantId));
  const hit = drafts.get(grantId);
  if (hit && hit.raw === raw) return hit.draft;
  if (!raw) {
    drafts.set(grantId, { raw: null, draft: SERVER_DRAFT });
    return SERVER_DRAFT;
  }
  try {
    const parsed = JSON.parse(raw) as BuyerDraft;
    const draft: BuyerDraft = {
      ...emptyDraft(),
      ...parsed,
      intake: { ...emptyIntake(), ...parsed.intake },
      notes: parsed.notes ?? {},
      missing: parsed.missing ?? {},
      files: parsed.files ?? {},
    };
    drafts.set(grantId, { raw, draft });
    return draft;
  } catch {
    drafts.set(grantId, { raw, draft: SERVER_DRAFT });
    return SERVER_DRAFT;
  }
}

export function saveDraft(grantId: string, draft: BuyerDraft) {
  const raw = JSON.stringify(draft);
  sessionStorage.setItem(draftKey(grantId), raw);
  drafts.set(grantId, { raw, draft });
  notify();
}

export function clearDraft(grantId: string) {
  sessionStorage.removeItem(draftKey(grantId));
  drafts.set(grantId, { raw: null, draft: SERVER_DRAFT });
  notify();
}

export function loadStoredResult(grantId: string): StoredResult | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(resultKey(grantId));
  const hit = results.get(grantId);
  if (hit && hit.raw === raw) return hit.result;
  if (!raw) {
    results.set(grantId, { raw: null, result: null });
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredResult;
    const result = parsed?.report?.id ? parsed : null;
    results.set(grantId, { raw, result });
    return result;
  } catch {
    results.set(grantId, { raw, result: null });
    return null;
  }
}

export function saveStoredResult(grantId: string, result: StoredResult) {
  const raw = JSON.stringify(result);
  sessionStorage.setItem(resultKey(grantId), raw);
  results.set(grantId, { raw, result });
  notify();
}

export function clearStoredResult(grantId: string) {
  sessionStorage.removeItem(resultKey(grantId));
  results.set(grantId, { raw: null, result: null });
  notify();
}
