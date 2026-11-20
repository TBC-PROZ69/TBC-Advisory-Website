"use client";

import { useEffect, useRef } from "react";

import { WizardButton } from "@/components/buyers/wizard-button";
import type { AnswerValue, BuyerArea, BuyerQuestion } from "@/lib/buyers/types";
import { cn } from "@/lib/utils";

const ANSWERS: AnswerValue[] = ["Yes", "No", "Partial", "Unknown", "N/A"];

export function QuestionStep({
  areas,
  areaIndex,
  questions,
  answers,
  notes,
  onAnswer,
  onNote,
  onBack,
  onNext,
}: {
  areas: BuyerArea[];
  areaIndex: number;
  questions: BuyerQuestion[];
  answers: Record<string, AnswerValue | "">;
  notes: Record<string, string>;
  onAnswer: (id: string, answer: AnswerValue) => void;
  onNote: (id: string, note: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const area = areas[areaIndex];
  const items = questions.filter((question) => question.area === area);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    document.getElementById("buyers-step")?.scrollIntoView({ block: "start" });
  }, [areaIndex, area]);

  return (
    <div className="mt-8 space-y-8 [overflow-anchor:none]">
      <div>
        <p className="text-xs tracking-[0.16em] text-brass uppercase">
          {areaIndex + 1} / {areas.length}
        </p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-heading mt-2 text-2xl text-navy outline-none"
        >
          {area}
        </h2>
        <p className="mt-2 text-sm text-navy/65">
          Blank answers count as Unknown and raise the concern score. N/A
          leaves the item out of the score.
        </p>
      </div>
      <ol className="space-y-8">
        {items.map((question) => (
          <li key={question.id} className="border-t border-navy/10 pt-6">
            <p className="text-xs tracking-wide text-navy/45">{question.id}</p>
            <p className="mt-2 text-base leading-relaxed text-navy">{question.prompt}</p>
            <p className="mt-2 text-sm leading-relaxed text-navy/60">{question.help}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {ANSWERS.map((answer) => (
                <button
                  key={answer}
                  type="button"
                  aria-pressed={answers[question.id] === answer}
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
            <label className="mt-3 block text-xs text-navy/55">
              Optional note
              <input
                className="mt-1 h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-navy"
                maxLength={500}
                value={notes[question.id] ?? ""}
                onChange={(event) => onNote(question.id, event.target.value)}
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
          {areaIndex >= areas.length - 1 ? "Continue to documents" : "Next area"}
        </WizardButton>
      </div>
    </div>
  );
}
