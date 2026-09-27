"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FLORIDA_COUNTIES } from "@/lib/assessment/counties";
import type { IntakeDraft } from "@/components/assess/storage";
import type {
  AssociationType,
  ControlStatus,
  IntakeData,
  SubmitterRole,
} from "@/lib/assessment/types";
import { cn } from "@/lib/utils";

const fieldClass = "h-11 rounded-md bg-white px-3 text-base md:text-sm";

export function IntakeForm({
  value,
  onChange,
  onContinue,
}: {
  value: IntakeDraft;
  onChange: (next: IntakeDraft) => void;
  onContinue: (intake: IntakeData) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof IntakeDraft>(key: K, next: IntakeDraft[K]) {
    onChange({ ...value, [key]: next });
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!value.associationName?.trim()) next.associationName = "Required.";
    if (value.associationType !== "HOA" && value.associationType !== "COA") {
      next.associationType = "Select HOA or COA.";
    }
    if (!value.county) next.county = "Select a county.";
    const yearBuilt = Number(value.yearBuilt);
    if (!yearBuilt || yearBuilt < 1800 || yearBuilt > 2026) {
      next.yearBuilt = "Enter the year built.";
    }
    const stories = Number(value.stories);
    if (!stories || stories < 1) next.stories = "Enter stories.";
    const units = Number(value.units);
    if (!units || units < 1) next.units = "Enter a count.";
    if (value.has3plus !== true && value.has3plus !== false) {
      next.has3plus = "Select yes or no.";
    }
    if (!value.control) next.control = "Select control status.";
    if (!value.submitterName?.trim()) next.submitterName = "Required.";
    if (!value.submitterRole) next.submitterRole = "Select a role.";
    if (!value.submitterEmail?.trim()) next.submitterEmail = "Required.";
    if (!value.submitterPhone?.trim()) next.submitterPhone = "Required.";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }
    onContinue({
      associationName: value.associationName!.trim(),
      associationType: value.associationType as AssociationType,
      county: value.county!,
      yearBuilt,
      stories,
      units,
      has3plus: value.has3plus as boolean,
      control: value.control as ControlStatus,
      submitterName: value.submitterName!.trim(),
      submitterRole: value.submitterRole as SubmitterRole,
      submitterEmail: value.submitterEmail!.trim(),
      submitterPhone: value.submitterPhone!.trim(),
      notes: value.notes?.trim() ?? "",
    });
  }

  const unitLabel = value.associationType === "HOA" ? "Parcels" : "Units";

  const typeHint = useMemo(() => {
    if (value.associationType === "HOA") {
      return "Chapter 720 homeowners’ association. Cooperatives are not in this screening.";
    }
    if (value.associationType === "COA") {
      return "Chapter 718 condominium. Cooperatives are not in this screening.";
    }
    return "Choose the statutory chapter that governs this association. Cooperatives are out of scope.";
  }, [value.associationType]);

  return (
    <form onSubmit={submit} className="space-y-8">
      <fieldset className="space-y-3">
        <legend className="text-[0.7rem] font-medium tracking-[0.18em] text-brass uppercase">
          Association type
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["HOA", "HOA (Ch. 720)"],
              ["COA", "COA (Ch. 718)"],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => set("associationType", code)}
              className={cn(
                "min-h-24 rounded-md border px-5 py-6 text-left text-xl font-heading text-navy",
                value.associationType === code
                  ? "border-primary bg-primary text-white"
                  : "border-navy/15 bg-card hover:border-navy/40",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-navy/60">{typeHint}</p>
        {errors.associationType ? (
          <p className="text-sm text-destructive">{errors.associationType}</p>
        ) : null}
      </fieldset>

      <Field label="Association name" error={errors.associationName}>
        <Input
          className={fieldClass}
          value={value.associationName ?? ""}
          onChange={(event) => set("associationName", event.target.value)}
        />
      </Field>

      <Field label="Florida county" error={errors.county}>
        <select
          className={cn(fieldClass, "w-full border border-input")}
          value={value.county ?? ""}
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

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Year built" error={errors.yearBuilt}>
          <Input
            className={fieldClass}
            inputMode="numeric"
            value={value.yearBuilt ?? ""}
            onChange={(event) =>
              set("yearBuilt", Number(event.target.value) || ("" as unknown as number))
            }
          />
        </Field>
        <Field
          label="Habitable stories of tallest residential building"
          error={errors.stories}
        >
          <Input
            className={fieldClass}
            inputMode="numeric"
            value={value.stories ?? ""}
            onChange={(event) =>
              set("stories", Number(event.target.value) || ("" as unknown as number))
            }
          />
        </Field>
        <Field
          label={value.associationType === "HOA" ? "Parcels" : unitLabel}
          error={errors.units}
        >
          <Input
            className={fieldClass}
            inputMode="numeric"
            value={value.units ?? ""}
            onChange={(event) =>
              set("units", Number(event.target.value) || ("" as unknown as number))
            }
          />
        </Field>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">
          Any building 3+ habitable stories?
        </legend>
        <div className="flex gap-3">
          {[true, false].map((flag) => (
            <button
              key={String(flag)}
              type="button"
              className={cn(
                "h-11 rounded-md border px-5 text-sm",
                value.has3plus === flag
                  ? "border-primary bg-primary text-white"
                  : "border-navy/15 bg-white",
              )}
              onClick={() => set("has3plus", flag)}
            >
              {flag ? "Yes" : "No"}
            </button>
          ))}
        </div>
        {errors.has3plus ? (
          <p className="text-sm text-destructive">{errors.has3plus}</p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Control</legend>
        <div className="grid gap-2">
          {(
            [
              "Owner-controlled",
              "Developer-controlled",
              "Mixed or unknown",
            ] as const
          ).map((option) => (
            <label key={option} className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name="control"
                checked={value.control === option}
                onChange={() => set("control", option)}
              />
              {option}
            </label>
          ))}
        </div>
        {errors.control ? (
          <p className="text-sm text-destructive">{errors.control}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" error={errors.submitterName}>
          <Input
            className={fieldClass}
            value={value.submitterName ?? ""}
            onChange={(event) => set("submitterName", event.target.value)}
          />
        </Field>
        <Field label="Role" error={errors.submitterRole}>
          <select
            className={cn(fieldClass, "w-full border border-input")}
            value={value.submitterRole ?? ""}
            onChange={(event) =>
              set("submitterRole", event.target.value as SubmitterRole)
            }
          >
            <option value="">Select role</option>
            <option value="director">Director</option>
            <option value="officer">Officer</option>
            <option value="manager">Manager</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Email" error={errors.submitterEmail}>
          <Input
            className={fieldClass}
            type="email"
            value={value.submitterEmail ?? ""}
            onChange={(event) => set("submitterEmail", event.target.value)}
          />
        </Field>
        <Field label="Phone" error={errors.submitterPhone}>
          <Input
            className={fieldClass}
            type="tel"
            value={value.submitterPhone ?? ""}
            onChange={(event) => set("submitterPhone", event.target.value)}
          />
        </Field>
      </div>

      <Field label="Notes (optional)">
        <Textarea
          className="min-h-24 rounded-md bg-white px-3 py-2"
          value={value.notes ?? ""}
          onChange={(event) => set("notes", event.target.value)}
        />
      </Field>

      <Button
        type="submit"
        className="h-11 rounded-md bg-primary px-6 text-white hover:bg-primary/90"
      >
        Continue to questions
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
