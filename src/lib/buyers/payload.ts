import { applicableQuestions } from "@/lib/buyers/applicability";
import { MAX_NOTE_CHARS } from "@/lib/buyers/constants";
import { BuyersError } from "@/lib/buyers/errors";
import { intakeIssues, toIntake, type IntakeDraft, type LinkContext } from "@/lib/buyers/intake";
import { isSlotChoice, isSlotId } from "@/lib/buyers/documents";
import type { AnswerValue, SlotChoice } from "@/lib/buyers/types";

const ANSWERS = new Set<AnswerValue>(["Yes", "No", "Partial", "Unknown", "N/A"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseIntakeDraft(value: unknown): IntakeDraft {
  if (!isRecord(value)) {
    throw new BuyersError("The property form is missing.", 400, "intake");
  }
  const text = (key: string) => (typeof value[key] === "string" ? value[key] : "");
  return {
    completer: text("completer") as IntakeDraft["completer"],
    buyerName: text("buyerName"),
    buyerEmail: text("buyerEmail"),
    buyerPhone: text("buyerPhone"),
    agentName: text("agentName"),
    agentEmail: text("agentEmail"),
    associationName: text("associationName"),
    county: text("county"),
    statute: text("statute") as IntakeDraft["statute"],
    unit: text("unit"),
    usePlan: text("usePlan") as IntakeDraft["usePlan"],
    stories3: text("stories3") as IntakeDraft["stories3"],
    yearBuilt: text("yearBuilt"),
    coastal: text("coastal") as IntakeDraft["coastal"],
    notes: text("notes"),
  };
}

export function parseCompletedIntake(value: unknown, link: LinkContext) {
  const draft = parseIntakeDraft(value);
  const issues = intakeIssues(draft, link);
  if (Object.keys(issues).length > 0) {
    throw new BuyersError("The property form is incomplete.", 400, "intake");
  }
  return toIntake(draft, link);
}

export function parseAnswerPayload(
  intake: ReturnType<typeof parseCompletedIntake>,
  answersValue: unknown,
  notesValue: unknown,
) {
  if (!isRecord(answersValue)) {
    throw new BuyersError("Answers are missing.", 400, "answers");
  }
  if (notesValue !== undefined && !isRecord(notesValue)) {
    throw new BuyersError("Notes are not valid.", 400, "notes");
  }
  const notesRecord = isRecord(notesValue) ? notesValue : {};
  const questions = applicableQuestions({
    statute: intake.statute,
    stories3: intake.stories3,
    yearBuilt: intake.yearBuilt,
    coastal: intake.coastal,
    usePlan: intake.usePlan,
  });
  const allowed = new Set(questions.map((question) => question.id));
  const answers: Record<string, AnswerValue | ""> = {};
  const notes: Record<string, string> = {};
  for (const [id, value] of Object.entries(answersValue)) {
    if (!allowed.has(id)) continue;
    if (value === "" || value === undefined || value === null) continue;
    if (typeof value !== "string" || !ANSWERS.has(value as AnswerValue)) {
      throw new BuyersError("An answer is not valid.", 400, "answers");
    }
    answers[id] = value as AnswerValue;
  }
  for (const [id, value] of Object.entries(notesRecord)) {
    if (!allowed.has(id) || typeof value !== "string") continue;
    const note = value.trim();
    if (!note) continue;
    if (note.length > MAX_NOTE_CHARS) {
      throw new BuyersError("A note is too long.", 400, "notes");
    }
    notes[id] = note;
  }
  return { questions, answers, notes };
}

export function parseChoices(value: unknown) {
  if (value === undefined) return {} as Record<string, SlotChoice>;
  if (!isRecord(value)) {
    throw new BuyersError("Document choices are not valid.", 400, "documents");
  }
  const choices: Record<string, SlotChoice> = {};
  for (const [id, choice] of Object.entries(value)) {
    if (!isSlotId(id) || typeof choice !== "string" || !isSlotChoice(choice)) {
      throw new BuyersError("A document choice is not valid.", 400, "documents");
    }
    choices[id] = choice;
  }
  return choices;
}
