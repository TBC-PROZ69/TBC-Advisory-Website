"use client";

import { useState } from "react";

import { WizardButton } from "@/components/buyers/wizard-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  intakeIssues,
  STATE_OPTIONS,
  type IntakeDraft,
} from "@/lib/buyers/intake";
import { cn } from "@/lib/utils";

const fieldClass = "h-11 rounded-md bg-white px-3 text-base md:text-sm";

export function IntakeForm({
  value,
  onChange,
  onContinue,
  onSample,
}: {
  value: IntakeDraft;
  onChange: (next: IntakeDraft) => void;
  onContinue: () => void;
  onSample?: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const issues = intakeIssues(value);

  function set<K extends keyof IntakeDraft>(key: K, next: IntakeDraft[K]) {
    onChange({ ...value, [key]: next });
  }

  function continueIfValid() {
    setAttempted(true);
    if (Object.keys(intakeIssues(value)).length > 0) return;
    onContinue();
  }

  return (
    <form
      className="mt-8 space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        continueIfValid();
      }}
    >
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
                "min-h-16 rounded-md border px-5 py-4 text-left font-heading text-xl",
                value.completer === code
                  ? "border-primary bg-primary text-white"
                  : "border-navy/15 bg-card text-navy hover:border-navy/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {attempted && issues.completer ? (
          <p className="text-sm text-destructive">{issues.completer}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" htmlFor="person-name" error={attempted ? issues.name : ""}>
          <Input
            id="person-name"
            className={fieldClass}
            value={value.name}
            autoComplete="name"
            onChange={(event) => set("name", event.target.value)}
          />
        </Field>
        <Field label="Email" htmlFor="person-email" error={attempted ? issues.email : ""}>
          <Input
            id="person-email"
            className={fieldClass}
            type="email"
            value={value.email}
            autoComplete="email"
            onChange={(event) => set("email", event.target.value)}
          />
        </Field>
      </div>

      <Field
        label="Association or property name"
        htmlFor="association-name"
        error={attempted ? issues.associationName : ""}
      >
        <Input
          id="association-name"
          className={fieldClass}
          value={value.associationName}
          onChange={(event) => set("associationName", event.target.value)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Unit address, optional"
          htmlFor="unit-address"
          error={issues.unitAddress}
        >
          <Input
            id="unit-address"
            className={fieldClass}
            value={value.unitAddress}
            onChange={(event) => set("unitAddress", event.target.value)}
          />
        </Field>
        <Field label="State" htmlFor="state" error={attempted ? issues.state : ""}>
          <select
            id="state"
            className={cn(fieldClass, "w-full border border-input")}
            value={value.state}
            onChange={(event) => set("state", event.target.value)}
          >
            {STATE_OPTIONS.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          Tallest residential building
        </legend>
        <p className="text-sm text-navy/60">
          Under 3 marks SIRS and the milestone report as Doesn&apos;t apply. You can
          change that on the checklist.
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["no", "Under 3"],
              ["yes", "3 or more"],
              ["unsure", "Not sure"],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => set("stories3", code)}
              className={cn(
                "h-11 rounded-md border px-4 text-sm",
                value.stories3 === code
                  ? "border-primary bg-primary text-white"
                  : "border-navy/15 bg-white text-navy",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {attempted && issues.stories3 ? (
          <p className="text-sm text-destructive">{issues.stories3}</p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <WizardButton onPress={continueIfValid}>Continue to the checklist</WizardButton>
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
