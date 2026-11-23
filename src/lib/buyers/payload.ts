import { BuyersError } from "@/lib/buyers/errors";
import { intakeIssues, toIntake, type IntakeDraft } from "@/lib/buyers/intake";
import { isSlotChoice, isSlotId, safeFileName } from "@/lib/buyers/documents";
import { MAX_FILE_BYTES, MAX_FILES, MAX_NOTE_CHARS } from "@/lib/buyers/constants";
import type { SlotChoice } from "@/lib/buyers/types";

export type DeclaredFile = {
  slot: string;
  fileName: string;
  byteSize: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : "";
}

export function parseIntakeDraft(value: unknown): IntakeDraft {
  if (!isRecord(value)) {
    throw new BuyersError("The property form is missing.", 400, "intake");
  }
  return {
    completer: text(value, "completer") as IntakeDraft["completer"],
    name: text(value, "name"),
    email: text(value, "email"),
    associationName: text(value, "associationName"),
    unitAddress: text(value, "unitAddress"),
    state: text(value, "state") || "FL",
    stories3: text(value, "stories3") as IntakeDraft["stories3"],
  };
}

export function parseCompletedIntake(value: unknown) {
  const draft = parseIntakeDraft(value);
  if (Object.keys(intakeIssues(draft)).length > 0) {
    throw new BuyersError("The property form is incomplete.", 400, "intake");
  }
  return toIntake(draft);
}

export function parseChoices(value: unknown) {
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

export function parseDeclaredFiles(value: unknown): DeclaredFile[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new BuyersError("Attached file list is not valid.", 400, "documents");
  }
  if (value.length > MAX_FILES) {
    throw new BuyersError("This packet already has the maximum number of files.", 400, "documents");
  }
  const files: DeclaredFile[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      throw new BuyersError("Attached file list is not valid.", 400, "documents");
    }
    const slot = text(item, "slot");
    if (!isSlotId(slot)) {
      throw new BuyersError("That document slot is not recognized.", 400, "documents");
    }
    const byteSize = item.byteSize;
    if (
      typeof byteSize !== "number" ||
      !Number.isFinite(byteSize) ||
      byteSize < 1 ||
      byteSize > MAX_FILE_BYTES
    ) {
      throw new BuyersError("An attached file size is not valid.", 400, "documents");
    }
    files.push({
      slot,
      fileName: safeFileName(text(item, "fileName")),
      byteSize: Math.round(byteSize),
    });
  }
  return files;
}

export function parseNotes(value: unknown) {
  if (value === undefined) return {} as Record<string, string>;
  if (!isRecord(value)) {
    throw new BuyersError("Notes are not valid.", 400, "notes");
  }
  const notes: Record<string, string> = {};
  for (const [id, note] of Object.entries(value)) {
    if (!isSlotId(id) || typeof note !== "string") continue;
    const clean = note.trim();
    if (!clean) continue;
    if (clean.length > MAX_NOTE_CHARS) {
      throw new BuyersError("A note is too long.", 400, "notes");
    }
    notes[id] = clean;
  }
  return notes;
}
