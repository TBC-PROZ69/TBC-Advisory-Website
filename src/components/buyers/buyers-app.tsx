"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { IntakeForm } from "@/components/buyers/intake-form";
import { QuestionStep } from "@/components/buyers/question-step";
import { ReportView } from "@/components/buyers/report-view";
import { sampleAnswers, sampleIntake } from "@/components/buyers/sample";
import {
  clearDraft,
  clearStoredResult,
  emptyDraft,
  getServerDraft,
  getServerResult,
  loadDraft,
  loadStoredResult,
  saveDraft,
  saveStoredResult,
  subscribeBuyers,
  type BuyerDraft,
} from "@/components/buyers/storage";
import { UploadStep } from "@/components/buyers/upload-step";
import { Container } from "@/components/container";
import { factsFromIntake } from "@/lib/buyers/applicability";
import { applicableQuestions } from "@/lib/buyers/applicability";
import { applicableSlots } from "@/lib/buyers/documents";
import { intakeIssues, toIntake, type LinkContext } from "@/lib/buyers/intake";
import type { BuyerReport } from "@/lib/buyers/report";
import { BUYER_AREAS, type BuyerSessionView } from "@/lib/buyers/types";
import { site } from "@/lib/site";

export function BuyersApp({
  token,
  session,
  allowSample,
}: {
  token: string;
  session: BuyerSessionView;
  allowSample: boolean;
}) {
  const draft = useSyncExternalStore(
    subscribeBuyers,
    () => loadDraft(session.grantId),
    getServerDraft,
  );
  const stored = useSyncExternalStore(
    subscribeBuyers,
    () => loadStoredResult(session.grantId),
    getServerResult,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const link = useMemo<LinkContext>(
    () => ({
      kind: session.kind,
      agentName: session.agentName,
      agentEmail: session.agentEmail,
      agentLicense: session.agentLicense,
    }),
    [session.kind, session.agentName, session.agentEmail, session.agentLicense],
  );

  useEffect(() => {
    if (!stored?.report.id) return;
    document.getElementById("buyers-step")?.scrollIntoView({ block: "start" });
  }, [stored?.report.id]);

  useEffect(() => {
    if (session.status !== "spent" || loadStoredResult(session.grantId)) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/buyers/report?t=${encodeURIComponent(token)}`);
      if (!response.ok || cancelled) return;
      const data = (await response.json()) as {
        report?: BuyerReport;
        emailed?: boolean;
      };
      if (!data.report || cancelled) return;
      saveStoredResult(session.grantId, {
        report: data.report,
        emailed: Boolean(data.emailed),
        linkStatus: "spent",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [session.grantId, session.status, token]);

  function update(recipe: (current: BuyerDraft) => BuyerDraft) {
    saveDraft(session.grantId, recipe(loadDraft(session.grantId)));
  }

  const facts = useMemo(() => {
    if (Object.keys(intakeIssues(draft.intake, link)).length > 0) return null;
    return factsFromIntake(toIntake(draft.intake, link));
  }, [draft.intake, link]);

  const questions = useMemo(
    () => (facts ? applicableQuestions(facts) : []),
    [facts],
  );
  const areas = BUYER_AREAS.filter((area) =>
    questions.some((question) => question.area === area),
  );
  const slots = facts ? applicableSlots(facts) : [];
  const answered = questions.filter((question) => draft.answers[question.id]).length;

  async function submitReport() {
    setBusy(true);
    setError("");
    try {
      const choices: Record<string, "uploaded" | "not-available" | "skipped"> = {};
      for (const slot of slots) {
        if ((draft.files[slot.id] ?? []).length > 0) choices[slot.id] = "uploaded";
        else if (draft.choices[slot.id] === "not-available") {
          choices[slot.id] = "not-available";
        } else choices[slot.id] = "skipped";
      }
      const response = await fetch("/api/buyers/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          t: token,
          intake: draft.intake,
          answers: draft.answers,
          notes: draft.notes,
          choices,
          consent: draft.consent,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        report?: BuyerReport;
        emailed?: boolean;
        linkStatus?: "active" | "spent";
      } | null;
      if (!response.ok || !data?.report) {
        throw new Error(data?.error || "The report could not be prepared.");
      }
      saveStoredResult(session.grantId, {
        report: data.report,
        emailed: Boolean(data.emailed),
        linkStatus: data.linkStatus ?? "active",
      });
      update((current) => ({ ...current, step: "results" }));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The report could not be prepared.",
      );
    } finally {
      setBusy(false);
    }
  }

  const report = stored?.report ?? null;

  if (session.status === "spent" && !report) {
    return (
      <Container className="max-w-2xl py-16">
        <h1 className="font-heading text-4xl text-navy">This link has been used</h1>
        <p className="mt-4 text-base leading-relaxed text-navy/75">
          This one-time link already produced a report. If you created it in
          this browser, it will appear here when it is still saved. Otherwise
          contact {site.email} and quote the property. A new property needs a
          new link.
        </p>
      </Container>
    );
  }

  return (
    <div className="bg-background">
      <Container className="max-w-3xl py-10 sm:py-14">
        <div id="buyers-step">
        {report && (draft.step === "results" || session.status === "spent") ? (
          <ReportView
            report={report}
            emailed={stored?.emailed ?? null}
            linkStatus={stored?.linkStatus ?? null}
            onAnother={
              session.kind === "agent" && stored?.linkStatus !== "spent"
                ? () => {
                    clearDraft(session.grantId);
                    clearStoredResult(session.grantId);
                    saveDraft(session.grantId, emptyDraft());
                  }
                : undefined
            }
          />
        ) : (
          <>
            <p className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
              Buyer screening
            </p>
            <h1 className="font-heading mt-3 text-3xl tracking-tight text-navy sm:text-4xl">
              Buyers Health Check
            </h1>
            <p className="mt-4 text-base leading-relaxed text-navy/75">
              A private screening for someone buying a Florida condominium or
              homeowners association property, or for their real estate agent.
              Chapter 719 cooperatives are out of scope.
            </p>
            <p className="mt-4 rounded-md border border-primary/30 bg-card p-4 text-sm leading-relaxed text-navy/75">
              This is not legal, financial, engineering, or inspection advice.
              TBC Advisory is not a property management company. The report is
              a reading of the answers you give, plus a list of documents you
              attach. It does not replace an estoppel, a title search, an
              inspection, or a Florida real estate attorney.
            </p>
            {session.overCap ? (
              <p className="mt-4 rounded-md border border-[#9a3412]/30 bg-[#fff1e6] p-4 text-sm text-[#9a3412]">
                This subscription has reached its courtesy volume of{" "}
                {session.monthlyCap} reports this month. You can still finish
                this report. TBC may follow up.
              </p>
            ) : null}
            {draft.step !== "intake" && questions.length > 0 ? (
              <div className="mt-8">
                <div className="flex items-center justify-between text-xs tracking-wide text-navy/60 uppercase">
                  <span>
                    {draft.step === "upload"
                      ? "Documents"
                      : draft.step === "questions"
                        ? "Questions"
                        : "Report"}
                  </span>
                  <span>
                    {answered} of {questions.length} answered
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-navy/10">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${questions.length ? Math.round((answered / questions.length) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {draft.step === "intake" ? (
              <IntakeForm
                value={draft.intake}
                link={link}
                onChange={(intake) => update((current) => ({ ...current, intake }))}
                onContinue={() =>
                  update((current) => ({ ...current, step: "questions", areaIndex: 0 }))
                }
                onSample={
                  allowSample
                    ? () =>
                        update((current) => ({
                          ...current,
                          intake: sampleIntake,
                          answers: sampleAnswers(),
                        }))
                    : undefined
                }
              />
            ) : null}

            {draft.step === "questions" && facts ? (
              <QuestionStep
                areas={areas}
                areaIndex={Math.min(draft.areaIndex, Math.max(areas.length - 1, 0))}
                questions={questions}
                answers={draft.answers}
                notes={draft.notes}
                onAnswer={(id, answer) =>
                  update((current) => ({
                    ...current,
                    answers: { ...current.answers, [id]: answer },
                  }))
                }
                onNote={(id, note) =>
                  update((current) => ({
                    ...current,
                    notes: { ...current.notes, [id]: note },
                  }))
                }
                onBack={() =>
                  update((current) =>
                    current.areaIndex <= 0
                      ? { ...current, step: "intake" }
                      : { ...current, areaIndex: current.areaIndex - 1 },
                  )
                }
                onNext={() =>
                  update((current) =>
                    current.areaIndex >= areas.length - 1
                      ? { ...current, step: "upload" }
                      : { ...current, areaIndex: current.areaIndex + 1 },
                  )
                }
              />
            ) : null}

            {draft.step === "upload" && facts ? (
              <>
                <UploadStep
                  token={token}
                  slots={slots}
                  consent={draft.consent}
                  choices={draft.choices}
                  files={draft.files}
                  busy={busy}
                  onConsent={(consent) => update((current) => ({ ...current, consent }))}
                  onChoice={(slot, choice) =>
                    update((current) => ({
                      ...current,
                      choices: { ...current.choices, [slot]: choice },
                    }))
                  }
                  onFileAdded={(slot, file) =>
                    update((current) => ({
                      ...current,
                      files: {
                        ...current.files,
                        [slot]: [...(current.files[slot] ?? []), file],
                      },
                    }))
                  }
                  onFileRemoved={(slot, fileId) =>
                    update((current) => ({
                      ...current,
                      files: {
                        ...current.files,
                        [slot]: (current.files[slot] ?? []).filter(
                          (file) => file.id !== fileId,
                        ),
                      },
                    }))
                  }
                  onBack={() =>
                    update((current) => ({
                      ...current,
                      step: "questions",
                      areaIndex: Math.max(areas.length - 1, 0),
                    }))
                  }
                  onContinue={() => void submitReport()}
                />
                {error ? (
                  <p role="alert" className="mt-4 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        )}
        </div>
      </Container>
    </div>
  );
}
