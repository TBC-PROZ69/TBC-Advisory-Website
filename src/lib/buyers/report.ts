import { storiesLabel } from "@/lib/buyers/applicability";
import { BuyersError } from "@/lib/buyers/errors";
import { BUYER_DISCLAIMER } from "@/lib/buyers/copy";
import {
  applicableSlots,
  documentRows,
  type PublicFile,
} from "@/lib/buyers/documents";
import { stateName } from "@/lib/buyers/intake";
import type {
  BuyerBand,
  BuyerIntake,
  DocumentStatus,
  GrantKind,
  SlotChoice,
} from "@/lib/buyers/types";

export type ReportDocument = {
  slot: string;
  title: string;
  status: DocumentStatus;
  files: { fileName: string; byteSize: number }[];
  note: string;
};

export type ReportFinding = {
  id: string;
  title: string;
  status: "received" | "not-provided";
  signal: "high" | "standard";
  text: string;
  note: string;
  files: string[];
};

export type BuyerReport = {
  id: string;
  createdAt: string;
  disclaimer: string;
  associationName: string;
  unitAddress: string;
  state: string;
  stateName: string;
  personName: string;
  personEmail: string;
  completer: string;
  agentLine: string | null;
  typedAgentLine: string | null;
  stories3: string;
  linkKind: GrantKind;
  overCap: boolean;
  monthlyCap: number | null;
  overallBand: BuyerBand;
  summary: string;
  addressed: number;
  total: number;
  findings: ReportFinding[];
  requests: { title: string; ask: string }[];
  notApplicable: { id: string; title: string }[];
  attachedNotes: ReportFinding[];
  documents: ReportDocument[];
};

function bandFor(highMissing: number, anyMissing: number): BuyerBand {
  if (!anyMissing) return "Low";
  if (highMissing >= 3) return "Critical";
  if (highMissing >= 1) return "Elevated";
  return "Moderate";
}

export function buildBuyerReport(input: {
  id: string;
  createdAt: string;
  intake: BuyerIntake;
  files: PublicFile[];
  choices: Record<string, SlotChoice | "">;
  notes: Record<string, string>;
  linkKind: GrantKind;
  subscriptionAgent: { name: string; license: string } | null;
  overCap: boolean;
  monthlyCap: number | null;
}): BuyerReport {
  const facts = { stories3: input.intake.stories3, state: input.intake.state };
  const slots = applicableSlots(facts);
  const rows = documentRows(facts, input.files, input.choices);
  const incomplete = slots.filter((slot) => {
    const row = rows.find((item) => item.slot === slot.id);
    return (
      !row ||
      (row.status !== "received" &&
        row.status !== "not-available" &&
        row.status !== "not-applicable")
    );
  });
  if (incomplete.length > 0) {
    const names = incomplete.map((slot) => slot.title);
    const count = names.length;
    throw new BuyersError(
      `${count} ${count === 1 ? "document still needs" : "documents still need"} an answer: ${names.join(", ")}.`,
      400,
      "checklist",
    );
  }
  for (const slot of slots) {
    if (input.choices[slot.id] === "not-applicable" && !slot.allowsNa) {
      const hasFile = input.files.some((file) => file.slot === slot.id);
      if (!hasFile) {
        throw new BuyersError(
          "That document cannot be marked as not applicable.",
          400,
          "checklist",
        );
      }
    }
  }

  const findings: ReportFinding[] = [];
  const attachedNotes: ReportFinding[] = [];
  const requests: { title: string; ask: string }[] = [];
  const notApplicable: { id: string; title: string }[] = [];
  let highMissing = 0;

  for (const slot of slots) {
    const row = rows.find((item) => item.slot === slot.id)!;
    const note = input.notes[slot.id]?.trim() ?? "";
    const names = row.files.map((file) => file.fileName);
    if (row.status === "not-available") {
      if (slot.signal === "high") highMissing += 1;
      findings.push({
        id: slot.id,
        title: slot.title,
        status: "not-provided",
        signal: slot.signal,
        text: slot.missing,
        note,
        files: [],
      });
      requests.push({ title: slot.title, ask: slot.request });
    } else if (row.status === "not-applicable") {
      notApplicable.push({ id: slot.id, title: slot.title });
    } else {
      attachedNotes.push({
        id: slot.id,
        title: slot.title,
        status: "received",
        signal: slot.signal,
        text: slot.attached,
        note,
        files: names,
      });
    }
  }

  const band = bandFor(highMissing, findings.length);
  const summary =
    findings.length === 0
      ? "Nothing was marked I don't have this. Doesn't apply is not treated as a risk. Attached files still need a person to read them. This check does not read the files."
      : `${findings.length} of ${slots.length} checklist items were marked I don't have this. Each of those is a finding. Doesn't apply is not.`;

  const floridaNote =
    input.intake.state === "FL"
      ? ""
      : " This checklist is written for Florida associations. SIRS and milestone inspections are Florida rules.";

  return {
    id: input.id,
    createdAt: input.createdAt,
    disclaimer: BUYER_DISCLAIMER,
    associationName: input.intake.associationName,
    unitAddress: input.intake.unitAddress,
    state: input.intake.state,
    stateName: stateName(input.intake.state),
    personName: input.intake.name,
    personEmail: input.intake.email,
    completer: input.intake.completer === "agent" ? "Real estate agent" : "Buyer",
    agentLine: input.subscriptionAgent
      ? `${input.subscriptionAgent.name}, Florida real estate license ${input.subscriptionAgent.license}`
      : null,
    typedAgentLine:
      input.linkKind === "one-time" && input.intake.completer === "agent"
        ? `${input.intake.name}. This name was typed on a one-time link. It is not a verified subscription.`
        : null,
    stories3: storiesLabel(input.intake.stories3),
    linkKind: input.linkKind,
    overCap: input.overCap,
    monthlyCap: input.monthlyCap,
    overallBand: band,
    summary: `${summary}${floridaNote}`,
    addressed: slots.length,
    total: slots.length,
    findings,
    requests,
    notApplicable,
    attachedNotes,
    documents: rows.map((row) => ({
      ...row,
      note: input.notes[row.slot]?.trim() ?? "",
    })),
  };
}

export function documentStatusLabel(status: DocumentStatus) {
  if (status === "received") return "Attached";
  if (status === "not-available") return "I don't have this";
  if (status === "not-applicable") return "Doesn't apply";
  return "Not addressed";
}
