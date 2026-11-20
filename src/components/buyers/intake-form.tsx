"use client";

import { useState } from "react";

import { FLORIDA_COUNTIES } from "@/lib/assessment/counties";
import { ASSESSMENT_YEAR } from "@/lib/assessment/types";
import { intakeIssues, type IntakeDraft, type LinkContext } from "@/lib/buyers/intake";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { WizardButton } from "@/components/buyers/wizard-button";

const fieldClass = "h-11 rounded-md bg-white px-3 text-base md:text-sm";

export function IntakeForm({
  value,
  link,
  onChange,
  onContinue,
  onSample,
}: {
  value: IntakeDraft;
  link: LinkContext;
  onChange: (next: IntakeDraft) => void;
  onContinue: () => void;
  onSample?: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const issues = intakeIssues(value, link);
  const showIssues = attempted;
  const tall = value.stories3 === "yes" || value.stories3 === "unsure";

  function continueIfValid() {
    setAttempted(true);
    if (Object.keys(intakeIssues(value, link)).length > 0) return;
    onContinue();
  }

  function set<K extends keyof IntakeDraft>(key: K, next: IntakeDraft[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <form
      className="mt-8 space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        continueIfValid();
      }}
    >
      {link.kind === "agent" ? (
        <div className="rounded-md border border-primary/30 bg-card p-4 text-sm leading-relaxed text-navy/80">
          <p className="text-[0.7rem] font-medium tracking-[0.16em] text-accent-foreground uppercase">
            Agent subscription
          </p>
          <p className="mt-2">
            This report will name {link.agentName}
            {link.agentLicense ? `, Florida license ${link.agentLicense}` : ""}.
            That name comes from the subscription link.
          </p>
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
          Who is completing this
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["buyer", "Buyer"],
              ["agent", "Real estate agent"],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => set("completer", code)}
              className={cn(
                "min-h-16 rounded-md border px-5 py-4 text-left font-heading text-xl text-navy",
                value.completer === code
                  ? "border-primary bg-primary text-white"
                  : "border-navy/15 bg-card hover:border-navy/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {showIssues && issues.completer ? (
          <p className="text-sm text-destructive">{issues.completer}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Buyer name" htmlFor="buyer-name" error={showIssues ? issues.buyerName : ""}>
          <Input
            id="buyer-name"
            className={fieldClass}
            value={value.buyerName}
            autoComplete="name"
            onChange={(event) => set("buyerName", event.target.value)}
          />
        </Field>
        <Field label="Buyer email" htmlFor="buyer-email" error={showIssues ? issues.buyerEmail : ""}>
          <Input
            id="buyer-email"
            className={fieldClass}
            type="email"
            value={value.buyerEmail}
            autoComplete="email"
            onChange={(event) => set("buyerEmail", event.target.value)}
          />
        </Field>
      </div>
      <Field label="Buyer phone, optional" htmlFor="buyer-phone" error={issues.buyerPhone}>
        <Input
          id="buyer-phone"
          className={fieldClass}
          value={value.buyerPhone}
          autoComplete="tel"
          onChange={(event) => set("buyerPhone", event.target.value)}
        />
      </Field>

      {link.kind === "one-time" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={value.completer === "agent" ? "Agent name" : "Agent name, optional"}
            htmlFor="agent-name"
            error={showIssues ? issues.agentName : ""}
          >
            <Input
              id="agent-name"
              className={fieldClass}
              value={value.agentName}
              onChange={(event) => set("agentName", event.target.value)}
            />
          </Field>
          <Field
            label={value.completer === "agent" ? "Agent email" : "Agent email, optional"}
            htmlFor="agent-email"
            error={showIssues ? issues.agentEmail : ""}
          >
            <Input
              id="agent-email"
              className={fieldClass}
              type="email"
              value={value.agentEmail}
              onChange={(event) => set("agentEmail", event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      <Field label="Association name" htmlFor="association-name" error={showIssues ? issues.associationName : ""}>
        <Input
          id="association-name"
          className={fieldClass}
          value={value.associationName}
          onChange={(event) => set("associationName", event.target.value)}
        />
      </Field>

      <Field label="Florida county" htmlFor="county" error={showIssues ? issues.county : ""}>
        <select
          id="county"
          className={cn(fieldClass, "w-full border border-input")}
          value={value.county}
          onChange={(event) => set("county", event.target.value)}
        >
          <option value="">Select county</option>
          {FLORIDA_COUNTIES.map((county) => (
            <option key={county} value={county}>
              {county}
            </option>
          ))}
        </select>
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Association statute</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["718", "Condominium (Ch. 718)"],
              ["720", "HOA (Ch. 720)"],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => set("statute", code)}
              className={cn(
                "min-h-16 rounded-md border px-5 py-4 text-left font-heading text-lg text-navy",
                value.statute === code
                  ? "border-primary bg-primary text-white"
                  : "border-navy/15 bg-card hover:border-navy/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-navy/60">
          Chapter 719 cooperatives are out of scope.
        </p>
        {showIssues && issues.statute ? (
          <p className="text-sm text-destructive">{issues.statute}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Unit, lot, or parcel" htmlFor="unit" error={showIssues ? issues.unit : ""}>
          <Input
            id="unit"
            className={fieldClass}
            value={value.unit}
            onChange={(event) => set("unit", event.target.value)}
          />
        </Field>
        <Field label="Year built, if known" htmlFor="year-built" error={issues.yearBuilt}>
          <Input
            id="year-built"
            className={fieldClass}
            inputMode="numeric"
            placeholder={`Blank if unknown, through ${ASSESSMENT_YEAR}`}
            value={value.yearBuilt}
            onChange={(event) => set("yearBuilt", event.target.value)}
          />
        </Field>
      </div>

      <Choice
        legend="How will the property be used?"
        value={value.usePlan}
        options={[
          ["live", "Live in it"],
          ["rent", "Rent it"],
          ["undecided", "Not decided"],
        ]}
        onChange={(next) => set("usePlan", next as IntakeDraft["usePlan"])}
        error={showIssues ? issues.usePlan : ""}
      />
      <Choice
        legend="Any residential building with 3 or more habitable stories?"
        value={value.stories3}
        options={[
          ["yes", "Yes"],
          ["no", "No"],
          ["unsure", "Not sure"],
        ]}
        onChange={(next) => set("stories3", next as IntakeDraft["stories3"])}
        error={showIssues ? issues.stories3 : ""}
      />
      {tall ? (
        <Choice
          legend="Is the building within 3 miles of the Florida coast?"
          value={value.coastal}
          options={[
            ["yes", "Yes"],
            ["no", "No"],
            ["unsure", "Not sure"],
          ]}
          onChange={(next) => set("coastal", next as IntakeDraft["coastal"])}
          error={showIssues ? issues.coastal : ""}
        />
      ) : null}

      <Field label="Notes, optional" htmlFor="intake-notes" error={issues.notes}>
        <Textarea
          id="intake-notes"
          className="min-h-24 bg-white text-base md:text-sm"
          value={value.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <WizardButton onPress={continueIfValid}>Continue to questions</WizardButton>
        {onSample ? (
          <WizardButton variant="outline" onPress={onSample}>
            Fill sample data
          </WizardButton>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-navy">
        {label}
      </Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function Choice({
  legend,
  value,
  options,
  onChange,
  error,
}: {
  legend: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (next: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([code, label]) => (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            className={cn(
              "h-11 rounded-md border px-4 text-sm",
              value === code
                ? "border-primary bg-primary text-white"
                : "border-navy/15 bg-white text-navy",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </fieldset>
  );
}
