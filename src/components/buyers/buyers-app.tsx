"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ChecklistStep } from "@/components/buyers/checklist-step";
import { IntakeForm } from "@/components/buyers/intake-form";
import { ReportView } from "@/components/buyers/report-view";
import { sampleIntake } from "@/components/buyers/sample";
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
import { Container } from "@/components/container";
import { applicableSlots, HEIGHT_NA_SLOTS } from "@/lib/buyers/documents";
import { intakeIssues, toIntake } from "@/lib/buyers/intake";
import type { BuyerReport } from "@/lib/buyers/report";
import type { BuyerSessionView, Tri } from "@/lib/buyers/types";
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
      const data = (await response.json()) as { report?: BuyerReport; emailed?: boolean };
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

  const slots = useMemo(() => {
    if (Object.keys(intakeIssues(draft.intake)).length > 0) return [];
    const intake = toIntake(draft.intake);
    return applicableSlots({ stories3: intake.stories3, state: intake.state });
  }, [draft.intake]);

  async function submitReport() {
    setBusy(true);
    setError("");
    try {
      const choices: Record<string, "uploaded" | "not-available" | "not-applicable"> = {};
      const declared: { slot: string; fileName: string; byteSize: number }[] = [];
      for (const slot of slots) {
        const slotFiles = draft.files[slot.id] ?? [];
        if (slotFiles.length > 0) {
          choices[slot.id] = "uploaded";
          for (const file of slotFiles) {
            declared.push({
              slot: slot.id,
              fileName: file.fileName,
              byteSize: file.byteSize,
            });
          }
        } else if (draft.na[slot.id] && slot.allowsNa) choices[slot.id] = "not-applicable";
        else if (draft.missing[slot.id]) choices[slot.id] = "not-available";
        else {
          throw new Error(`1 document still needs an answer: ${slot.title}.`);
        }
      }
      const response = await fetch("/api/buyers/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          t: token,
          intake: draft.intake,
          notes: draft.notes,
          choices,
          files: declared,
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
        submitError instanceof Error ? submitError.message : "The report could not be prepared.",
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
          This one-time link already produced a report. If you created it in this
          browser, it will appear here when it is still saved. Otherwise contact{" "}
          {site.email}. A new property needs a new link.
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
              token={token}
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
                A short checklist and guidance for a Florida condominium or
                homeowners association purchase. You do not need to know how the
                association is run. Mark what you have, and what you do not.
              </p>
              <p className="mt-4 rounded-md border border-primary/30 bg-card p-4 text-sm leading-relaxed text-navy/75">
                This is not legal, financial, engineering, or inspection advice.
                TBC Advisory is not a property management company. The report
                records which documents you attached and which you do not have.
                It does not read the files.
              </p>
              {session.kind === "agent" ? (
                <p className="mt-4 rounded-md border border-navy/10 bg-card p-4 text-sm text-navy/80">
                  This report will name {session.agentName}
                  {session.agentLicense ? `, Florida license ${session.agentLicense}` : ""}.
                </p>
              ) : null}
              {session.overCap ? (
                <p className="mt-4 rounded-md border border-[#9a3412]/30 bg-[#fff1e6] p-4 text-sm text-[#9a3412]">
                  This subscription has reached its courtesy volume of {session.monthlyCap}{" "}
                  reports this month. You can still finish this report. TBC may follow up.
                </p>
              ) : null}

              {draft.step === "intake" ? (
                <IntakeForm
                  value={draft.intake}
                  onChange={(intake) =>
                    update((current) =>
                      applyStoriesDefault(
                        { ...current, intake },
                        current.intake.stories3,
                        intake.stories3,
                      ),
                    )
                  }
                  onContinue={() => update((current) => ({ ...current, step: "checklist" }))}
                  onSample={
                    allowSample
                      ? () => update((current) => ({ ...current, intake: sampleIntake }))
                      : undefined
                  }
                />
              ) : null}

              {draft.step === "checklist" ? (
                <>
                  <ChecklistStep
                    token={token}
                    slots={slots}
                    consent={draft.consent}
                    missing={draft.missing}
                    na={draft.na}
                    notes={draft.notes}
                    files={draft.files}
                    busy={busy}
                    onConsent={(consent) => update((current) => ({ ...current, consent }))}
                    onMissing={(slot, value) =>
                      update((current) => ({
                        ...current,
                        missing: { ...current.missing, [slot]: value },
                        na: value ? { ...current.na, [slot]: false } : current.na,
                      }))
                    }
                    onNa={(slot, value) =>
                      update((current) => ({
                        ...current,
                        na: { ...current.na, [slot]: value },
                        missing: value ? { ...current.missing, [slot]: false } : current.missing,
                      }))
                    }
                    onNote={(slot, note) =>
                      update((current) => ({
                        ...current,
                        notes: { ...current.notes, [slot]: note },
                      }))
                    }
                    onFileAdded={(slot, file) =>
                      update((current) => ({
                        ...current,
                        files: {
                          ...current.files,
                          [slot]: [...(current.files[slot] ?? []), file],
                        },
                        missing: { ...current.missing, [slot]: false },
                        na: { ...current.na, [slot]: false },
                      }))
                    }
                    onFileRemoved={(slot, fileId) =>
                      update((current) => ({
                        ...current,
                        files: {
                          ...current.files,
                          [slot]: (current.files[slot] ?? []).filter((file) => file.id !== fileId),
                        },
                      }))
                    }
                    onBack={() => update((current) => ({ ...current, step: "intake" }))}
                    onSubmit={() => void submitReport()}
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

function applyStoriesDefault(
  draft: BuyerDraft,
  previous: Tri | "",
  next: Tri | "",
): BuyerDraft {
  if (next === previous) return draft;
  const na = { ...draft.na };
  const missing = { ...draft.missing };
  if (next === "no") {
    for (const id of HEIGHT_NA_SLOTS) {
      if ((draft.files[id] ?? []).length > 0) continue;
      na[id] = true;
      missing[id] = false;
    }
  } else if (previous === "no") {
    for (const id of HEIGHT_NA_SLOTS) {
      if ((draft.files[id] ?? []).length > 0) continue;
      na[id] = false;
    }
  }
  return { ...draft, na, missing };
}
