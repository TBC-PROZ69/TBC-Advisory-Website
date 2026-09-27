"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { IntakeForm } from "@/components/assess/intake-form";
import {
  goToNextDomain,
  goToPreviousDomain,
  withAnswer,
  withItemNote,
} from "@/components/assess/navigate";
import {
  emptyDraft,
  getServerDraft,
  loadDraft,
  saveDraft,
  subscribeDraft,
  type AssessDraft,
} from "@/components/assess/storage";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/container";
import { applicableQuestions, mileApplies } from "@/lib/assessment/applicability";
import { statuteTrackLabel } from "@/lib/assessment/tracks";
import { DOMAIN_ORDER, type AnswerValue, type IntakeData } from "@/lib/assessment/types";
import type { AssessmentQuestion } from "@/lib/assessment/types";
import { cn } from "@/lib/utils";

const ANSWERS: AnswerValue[] = ["Yes", "No", "Partial", "Unknown", "N/A"];

export function AssessApp({ accessKey }: { accessKey?: string }) {
  const draft = useSyncExternalStore(subscribeDraft, loadDraft, getServerDraft);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Always patch the latest snapshot. Handlers that spread a closed-over
  // `draft` let a note write landing after Next replace the whole record and
  // rewind domainIndex, so the wizard looks stuck between domains.
  function update(recipe: (current: AssessDraft) => AssessDraft) {
    saveDraft(recipe(loadDraft()));
  }

  const facts = useMemo(() => {
    if (!isCompleteIntake(draft.intake)) return null;
    return {
      type: draft.intake.associationType,
      stories: Number(draft.intake.stories),
      units: Number(draft.intake.units),
      yearBuilt: Number(draft.intake.yearBuilt),
      has3plus: draft.intake.has3plus === true,
    };
  }, [draft.intake]);

  const questions = useMemo(
    () => (facts ? applicableQuestions(facts) : []),
    [facts],
  );

  const domains = DOMAIN_ORDER.filter((domain) =>
    questions.some((question) => question.domain === domain),
  );

  const answered = questions.filter((question) => draft.answers[question.id])
    .length;
  const progress = questions.length
    ? Math.round((answered / questions.length) * 100)
    : 0;

  if (draft.step === "done") {
    return (
      <Container className="max-w-2xl py-16 sm:py-24">
        <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
          Received
        </p>
        <h1 className="font-heading mt-3 text-4xl text-navy">Thank you</h1>
        <p className="mt-4 text-base leading-relaxed text-navy/75">
          Your screening was submitted to TBC Advisory. We will review the
          operational picture and follow up. This page does not display a scored
          roadmap—that work product stays with TBC.
        </p>
        <p className="mt-4 text-sm text-navy/60">
          Screening tool — not legal advice, not an engineering inspection. TBC
          Advisory is not a property management company.
        </p>
      </Container>
    );
  }

  return (
    <div className="bg-cream">
      <Container className="max-w-3xl py-10 sm:py-14">
        <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
          Board screening
        </p>
        <h1 className="font-heading mt-3 text-3xl tracking-tight text-navy sm:text-4xl">
          Association assessment
        </h1>
        <p className="mt-4 rounded-md border border-brass/40 bg-card p-4 text-sm leading-relaxed text-navy/75">
          This is a screening tool. It is not legal advice and not an engineering
          inspection. TBC Advisory is not a property management company. Chapter
          719 cooperatives are out of scope.
        </p>

        {draft.step !== "intake" && questions.length > 0 ? (
          <div className="mt-8">
            <div className="flex items-center justify-between text-xs tracking-wide text-navy/60 uppercase">
              <span>Progress</span>
              <span>
                {answered} of {questions.length}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy/10">
              <div
                className="h-full bg-brass"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {draft.step === "intake" ? (
          <div className="mt-10">
            <IntakeForm
              value={draft.intake}
              onChange={(intake) => update((current) => ({ ...current, intake }))}
              onContinue={(intake) =>
                update((current) => ({
                  ...current,
                  intake,
                  step: "questions",
                  domainIndex: 0,
                }))
              }
            />
          </div>
        ) : null}

        {draft.step === "questions" && facts ? (
          <QuestionStep
            domains={domains}
            domainIndex={Math.min(
              Number.isInteger(draft.domainIndex) ? draft.domainIndex : 0,
              Math.max(domains.length - 1, 0),
            )}
            trackLabel={statuteTrackLabel(facts.type)}
            questions={questions}
            answers={draft.answers}
            notes={draft.itemNotes}
            showMileNote={mileApplies(facts)}
            onBack={() => update(goToPreviousDomain)}
            onNotes={(id, note) =>
              update((current) => withItemNote(current, id, note))
            }
            onAnswer={(id, answer) =>
              update((current) => withAnswer(current, id, answer))
            }
            onNext={() =>
              update((current) => goToNextDomain(current, domains.length))
            }
          />
        ) : null}

        {draft.step === "review" ? (
          <ReviewStep
            questions={questions}
            draft={draft}
            error={submitError}
            submitting={submitting}
            onBack={() =>
              update((current) => ({
                ...current,
                step: "questions",
                domainIndex: Math.max(domains.length - 1, 0),
              }))
            }
            onSubmit={async () => {
              if (!isCompleteIntake(draft.intake)) return;
              setSubmitting(true);
              setSubmitError("");
              try {
                const response = await fetch("/api/assess", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    k: accessKey,
                    intake: draft.intake,
                    answers: draft.answers,
                    itemNotes: draft.itemNotes,
                  }),
                });
                if (!response.ok) {
                  const data = (await response.json().catch(() => null)) as
                    | { error?: string }
                    | null;
                  throw new Error(data?.error || "Submit failed.");
                }
                saveDraft({ ...emptyDraft(), step: "done" });
              } catch (error) {
                setSubmitError(
                  error instanceof Error ? error.message : "Submit failed.",
                );
              } finally {
                setSubmitting(false);
              }
            }}
          />
        ) : null}
      </Container>
    </div>
  );
}

function isCompleteIntake(
  intake: AssessDraft["intake"] | undefined,
): intake is IntakeData {
  return Boolean(
    intake &&
      intake.associationName &&
      (intake.associationType === "HOA" || intake.associationType === "COA") &&
      intake.county &&
      Number(intake.yearBuilt) > 0 &&
      Number(intake.stories) > 0 &&
      Number(intake.units) > 0 &&
      (intake.has3plus === true || intake.has3plus === false) &&
      intake.control &&
      intake.submitterName &&
      intake.submitterRole &&
      intake.submitterEmail &&
      intake.submitterPhone,
  );
}

function QuestionStep({
  domains,
  domainIndex,
  trackLabel,
  questions,
  answers,
  notes,
  showMileNote,
  onAnswer,
  onNotes,
  onBack,
  onNext,
}: {
  domains: typeof DOMAIN_ORDER;
  domainIndex: number;
  trackLabel: string;
  questions: AssessmentQuestion[];
  answers: AssessDraft["answers"];
  notes: Record<string, string>;
  showMileNote: boolean;
  onAnswer: (id: string, answer: AnswerValue) => void;
  onNotes: (id: string, note: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const domain = domains[domainIndex];
  const items = questions.filter((question) => question.domain === domain);
  const startRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const start = startRef.current;
    const heading = headingRef.current;
    if (!start || !heading) return;
    // Scroll anchoring would otherwise pin the viewport to the Next button
    // after the question list is replaced, so the new domain never comes into view.
    const align = () => {
      const top = start.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo(0, Math.max(0, top));
    };
    align();
    const frame = requestAnimationFrame(align);
    heading.focus({ preventScroll: true });
    return () => cancelAnimationFrame(frame);
  }, [domainIndex, domain]);

  return (
    <div className="mt-10 space-y-8 [overflow-anchor:none]">
      <div ref={startRef}>
        <p className="text-xs tracking-[0.16em] text-brass uppercase">
          {trackLabel} · {domainIndex + 1} / {domains.length}
        </p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-heading mt-2 text-2xl text-navy outline-none"
        >
          {domain}
        </h2>
      </div>
      {showMileNote && domain === "Milestone/Safety" ? (
        <p className="rounded-md border border-navy/15 bg-card p-4 text-sm text-navy/75">
          Milestone inspection under s. 553.899 generally applies at 30 years
          for residential condominium buildings of three habitable stories or
          more, or 25 years if the local enforcement agency requires it because
          of local circumstances including proximity to salt water. Confirm the
          local rule with the authority having jurisdiction.
        </p>
      ) : null}
      <ol className="space-y-8">
        {items.map((question) => (
          <li key={question.id} className="border-t border-navy/10 pt-6">
            <p className="text-xs tracking-wide text-navy/45">{question.id}</p>
            <p className="mt-2 text-base leading-relaxed text-navy">
              {question.question}
            </p>
            <p className="mt-2 text-xs text-navy/50">{question.cite}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ANSWERS.map((answer) => (
                <button
                  key={answer}
                  type="button"
                  className={cn(
                    "h-10 rounded-md border px-3 text-sm",
                    answers[question.id] === answer
                      ? "border-primary bg-primary text-white"
                      : "border-navy/15 bg-white text-navy",
                  )}
                  onClick={() => onAnswer(question.id, answer)}
                >
                  {answer}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs text-navy/50">
              Optional note
              <input
                className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-navy"
                value={notes[question.id] ?? ""}
                onChange={(event) => onNotes(question.id, event.target.value)}
              />
            </label>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        <WizardButton variant="outline" onPress={onBack}>
          Back
        </WizardButton>
        <WizardButton onPress={onNext}>
          {domainIndex >= domains.length - 1 ? "Review" : "Next domain"}
        </WizardButton>
      </div>
    </div>
  );
}

function ReviewStep({
  questions,
  draft,
  error,
  submitting,
  onBack,
  onSubmit,
}: {
  questions: AssessmentQuestion[];
  draft: AssessDraft;
  error: string;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const trackLabel =
    draft.intake.associationType === "HOA" ||
    draft.intake.associationType === "COA"
      ? statuteTrackLabel(draft.intake.associationType)
      : null;

  useEffect(() => {
    const heading = headingRef.current;
    if (!heading) return;
    const top = heading.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo(0, Math.max(0, top));
    heading.focus({ preventScroll: true });
  }, []);

  return (
    <div className="mt-10 space-y-8 print:mt-0">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-heading scroll-mt-6 text-2xl text-navy outline-none"
      >
        Review
      </h2>
      <p className="text-sm text-navy/70">
        Print this page for the board if useful. Scores are not shown here.
      </p>
      <dl className="grid gap-2 text-sm text-navy/80">
        <div>
          <dt className="text-navy/45">Association</dt>
          <dd>{draft.intake.associationName}</dd>
        </div>
        <div>
          <dt className="text-navy/45">Type</dt>
          <dd>
            {trackLabel ?? draft.intake.associationType} · {draft.intake.county}{" "}
            County
          </dd>
        </div>
      </dl>
      <ol className="space-y-4">
        {questions.map((question) => (
          <li key={question.id} className="border-t border-navy/10 pt-3 text-sm">
            <p className="text-xs text-navy/45">
              {question.id} · {question.domain}
            </p>
            <p className="mt-1 text-navy">{question.question}</p>
            <p className="mt-1 font-medium text-navy">
              {draft.answers[question.id] || "Not answered"}
            </p>
            {draft.itemNotes[question.id] ? (
              <p className="mt-1 text-navy/60">{draft.itemNotes[question.id]}</p>
            ) : null}
          </li>
        ))}
      </ol>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-3 print:hidden">
        <WizardButton variant="outline" onPress={onBack}>
          Back
        </WizardButton>
        <WizardButton disabled={submitting} onPress={onSubmit}>
          {submitting ? "Submitting…" : "Submit to TBC Advisory"}
        </WizardButton>
      </div>
    </div>
  );
}

function WizardButton({
  onPress,
  children,
  variant = "default",
  disabled = false,
}: {
  onPress: () => void;
  children: React.ReactNode;
  variant?: "default" | "outline";
  disabled?: boolean;
}) {
  const ignoreClickUntil = useRef(0);

  return (
    <Button
      type="button"
      variant={variant}
      disabled={disabled}
      className={cn(
        "h-11",
        variant === "default" && "bg-primary text-white hover:bg-primary/90",
      )}
      onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        // A focused note field swallows the tap: the browser blurs the input
        // and never delivers click. preventDefault keeps the activation.
        event.preventDefault();
      }}
      onPointerUp={(event: ReactPointerEvent<HTMLButtonElement>) => {
        if (disabled || event.pointerType === "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;
        if (!inside) return;
        ignoreClickUntil.current = performance.now() + 400;
        onPress();
      }}
      onClick={() => {
        if (disabled) return;
        if (performance.now() < ignoreClickUntil.current) return;
        onPress();
      }}
    >
      {children}
    </Button>
  );
}
