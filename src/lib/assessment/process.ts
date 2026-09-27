import { applicableQuestions } from "@/lib/assessment/applicability";
import { buildRoadmapEmail } from "@/lib/assessment/email";
import { persistSubmission } from "@/lib/assessment/persist";
import { FLORIDA_COUNTIES } from "@/lib/assessment/counties";
import { isValidEmail } from "@/lib/forms";
import type { AnswerMap } from "@/lib/assessment/scoring";
import type {
  AnswerValue,
  AssociationType,
  ControlStatus,
  IntakeData,
  SubmitterRole,
} from "@/lib/assessment/types";

const ANSWERS: AnswerValue[] = ["Yes", "No", "Partial", "Unknown", "N/A"];
const TYPES: AssociationType[] = ["HOA", "COA"];
const ROLES: SubmitterRole[] = ["director", "officer", "manager", "other"];
const CONTROL: ControlStatus[] = [
  "Owner-controlled",
  "Developer-controlled",
  "Mixed or unknown",
];

export type AssessPayload = {
  k?: string;
  intake: IntakeData;
  answers: AnswerMap;
  itemNotes?: Record<string, string>;
};

function isAnswer(value: unknown): value is AnswerValue {
  return typeof value === "string" && ANSWERS.includes(value as AnswerValue);
}

export function parseAssessPayload(body: unknown): AssessPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid submission.");
  }
  const raw = body as Record<string, unknown>;
  const intakeRaw = raw.intake;
  if (!intakeRaw || typeof intakeRaw !== "object") {
    throw new Error("Intake is required.");
  }
  const intake = intakeRaw as Record<string, unknown>;

  const associationName = String(intake.associationName ?? "").trim();
  const associationType = intake.associationType as AssociationType;
  const county = String(intake.county ?? "").trim();
  const yearBuilt = Number(intake.yearBuilt);
  const stories = Number(intake.stories);
  const units = Number(intake.units);
  const submitterName = String(intake.submitterName ?? "").trim();
  const submitterRole = intake.submitterRole as SubmitterRole;
  const submitterEmail = String(intake.submitterEmail ?? "").trim();
  const submitterPhone = String(intake.submitterPhone ?? "").trim();

  if (!associationName) throw new Error("Association name is required.");
  if (!TYPES.includes(associationType)) {
    throw new Error("Association type must be HOA or COA.");
  }
  if (!(FLORIDA_COUNTIES as readonly string[]).includes(county)) {
    throw new Error("Select a Florida county.");
  }
  if (!Number.isFinite(yearBuilt) || yearBuilt < 1800 || yearBuilt > 2026) {
    throw new Error("Enter a valid year built.");
  }
  if (!Number.isFinite(stories) || stories < 1) {
    throw new Error("Enter habitable stories of the tallest residential building.");
  }
  if (!Number.isFinite(units) || units < 1) {
    throw new Error("Enter units (COA) or parcels (HOA).");
  }
  if (typeof intake.has3plus !== "boolean") {
    throw new Error("Indicate whether any building has 3+ habitable stories.");
  }
  if (!CONTROL.includes(intake.control as ControlStatus)) {
    throw new Error("Select control status.");
  }
  if (!submitterName) throw new Error("Submitter name is required.");
  if (!ROLES.includes(submitterRole)) throw new Error("Select a role.");
  if (!isValidEmail(submitterEmail)) throw new Error("Enter a valid email.");
  if (!submitterPhone) throw new Error("Phone is required.");

  const answersRaw =
    raw.answers && typeof raw.answers === "object"
      ? (raw.answers as Record<string, unknown>)
      : {};
  const answers: AnswerMap = {};
  for (const [id, value] of Object.entries(answersRaw)) {
    if (value === "" || value === undefined) continue;
    if (!isAnswer(value)) throw new Error(`Invalid answer for ${id}.`);
    answers[id] = value;
  }

  const notesRaw =
    raw.itemNotes && typeof raw.itemNotes === "object"
      ? (raw.itemNotes as Record<string, unknown>)
      : {};
  const itemNotes: Record<string, string> = {};
  for (const [id, value] of Object.entries(notesRaw)) {
    if (typeof value === "string" && value.trim()) itemNotes[id] = value.trim();
  }

  const parsedIntake: IntakeData = {
    associationName,
    associationType,
    county,
    yearBuilt,
    stories,
    units,
    has3plus: intake.has3plus,
    control: intake.control as ControlStatus,
    submitterName,
    submitterRole,
    submitterEmail,
    submitterPhone,
    notes: String(intake.notes ?? "").trim(),
  };

  return {
    k: typeof raw.k === "string" ? raw.k : undefined,
    intake: parsedIntake,
    answers,
    itemNotes,
  };
}

export async function processAssessment(payload: AssessPayload) {
  const questions = applicableQuestions({
    type: payload.intake.associationType,
    stories: payload.intake.stories,
    units: payload.intake.units,
    yearBuilt: payload.intake.yearBuilt,
    has3plus: payload.intake.has3plus,
  });

  const email = buildRoadmapEmail(
    payload.intake,
    questions,
    payload.answers,
    payload.itemNotes ?? {},
  );

  const id = `${Date.now()}-${payload.intake.associationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)}`;

  const record = {
    id,
    submittedAt: new Date().toISOString(),
    intake: payload.intake,
    answers: payload.answers,
    itemNotes: payload.itemNotes ?? {},
    applicableIds: questions.map((question) => question.id),
    roadmap: email.roadmap,
    emailSubject: email.subject,
    emailText: email.text,
  };

  const persisted = await persistSubmission(id, record);
  const notify =
    process.env.ASSESS_NOTIFY_EMAIL?.trim() || "info@tbcadvisory.com";

  let emailed = false;
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "Assess: RESEND_API_KEY missing; email skipped. Roadmap is in the submission record.",
    );
  } else {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from =
        process.env.RESEND_FROM?.trim() ||
        "TBC Advisory assess <notify@tbcadvisory.com>";
      const result = await resend.emails.send({
        from,
        to: [notify],
        replyTo: payload.intake.submitterEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (result.error) {
        console.error("Assess: Resend error", result.error);
      } else {
        emailed = true;
      }
    } catch (error) {
      console.error("Assess: email send failed", error);
    }
  }

  return { id, emailed, persisted, notify };
}
